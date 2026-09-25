---
title: Idempotency is a database constraint, not an if-statement
description: Why "check if it exists, then insert" loses the race it was written to prevent, and where the rule has to live instead.
date: 2026-09-25
tags: [PostgreSQL, idempotency, concurrency]
---

Every system that receives events from the outside world gets duplicates. Webhook providers
retry. Card networks retry. Kafka redelivers after a consumer crashes between processing and
committing its offset. So the handler has to be idempotent: processing the same event twice must
have the same effect as processing it once.

The first version almost everyone writes looks like this:

```go
exists, _ := repo.EventExists(ctx, evt.ID)
if exists {
    return nil
}
return repo.ApplyEvent(ctx, evt)
```

It passes every test you write with one goroutine. It fails in production, because two workers
can receive the same event at the same instant:

| Worker A | Worker B |
|---|---|
| `EventExists` → false | |
| | `EventExists` → false |
| `ApplyEvent` → credit $100 | |
| | `ApplyEvent` → credit $100 |

Both checks happened before either write. The check and the write are two separate operations,
and nothing stops another writer from landing between them.

## Put the rule where writers are serialised

The database is the one component that actually serialises concurrent writers to the same row.
So the rule goes there:

```sql
CREATE TABLE processed_events (
    event_id   TEXT PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

And the handler records the event and applies its effect in **one transaction**:

```go
tx, _ := db.BeginTx(ctx, nil)
defer tx.Rollback()

_, err := tx.ExecContext(ctx,
    `INSERT INTO processed_events (event_id) VALUES ($1)`, evt.ID)
if isUniqueViolation(err) {
    return nil // someone else already applied it
}
if err != nil {
    return err
}
if err := applyEffect(ctx, tx, evt); err != nil {
    return err
}
return tx.Commit()
```

Now the second worker's insert blocks on the first one's uncommitted row, and then fails with a
unique violation when the first commits. Exactly one credit happens, and the loser finds out
cleanly.

## Two details that matter

**The record and the effect must commit together.** If you insert into `processed_events` and
commit, then apply the effect in a second transaction, a crash between the two marks the event as
done when it never happened. That is a lost event, which for money is worse than a duplicate.

**Test it concurrently or you have not tested it.** A test that calls the handler twice in
sequence proves nothing about this bug. Start N goroutines on a barrier, release them together
with the same event, and assert the balance moved once.

The application-level check is still fine as an optimisation to skip work early. It just cannot
be the thing you rely on.
