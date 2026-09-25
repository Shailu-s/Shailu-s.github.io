---
title: A credit ledger where a race cannot double-apply money
kicker: Ledgers & correctness
org: Qiro Finance, revolving credit
period: 2026 to present
order: 3
summary: The backend of a revolving line of credit, modelled as a state machine over an append-only ledger. Invariants live in the database, not the application, and events arrive from two independent sources so none are lost or applied twice.
stack: [TypeScript, PostgreSQL, Docker, GitHub Actions, AWS]
metrics:
  - { value: '0', label: 'floats anywhere in the money path' }
  - { value: '2', label: 'independent event sources, reconciled' }
  - { value: '1', label: 'place each rule lives: the database' }
flow:
  - { label: 'Event', detail: 'draw, repay, missed payment' }
  - { label: 'Webhook + scanner', detail: 'push path and polling safety net' }
  - { label: 'Idempotent write', detail: 'unique constraint per event' }
  - { label: 'State machine', detail: 'only legal transitions apply' }
  - { label: 'Append-only ledger', detail: 'replayable, never updated' }
codeNote: This is my current employer's production system, so the code is private. The design is described at the level it appears on my resume.
---

## The problem

A revolving line of credit works like a credit card rather than a loan: a borrower draws
against a limit, repays, and can draw again. The backend has to track drawn and undrawn balances,
repayments, missed payments and recovery, and it has to agree exactly with the external system
that actually holds the funds.

In this domain a bug is not cosmetic. It is someone's money, and it is legal exposure.

## The constraint that shaped it

**The system must be correct even when two workers process the same event at the same instant.**
Webhook providers retry. Scanners overlap. Anything that relies on application code checking
"have I seen this before" loses that race: both workers read "not found", both insert.

## The design

- **An explicit state machine.** Borrowing, repayment, missed payment and recovery are states
  with named transitions. An event that is not a legal transition from the current state is
  rejected, not coerced.
- **An append-only ledger.** Entries are never updated or deleted. Current balances are a
  projection, and the whole history can be **replayed deterministically** to reproduce them.
- **Arbitrary-precision integer arithmetic.** No floats, so rounding cannot quietly lose money.
- **Invariants enforced by Postgres.** Uniqueness and balance rules are database constraints
  inside atomic transactions. The database is the only thing that actually serialises two
  concurrent writers, so it is where the rule has to live.

## Two sources for every event

Webhooks are the fast path, but a webhook provider can drop an event and never tell you. So an
independent **polling scanner** reads the source of truth as a safety net. Both write through the
same idempotent path, so an event seen twice is applied once. **Gap detection** notices when the
ledger is missing a range and backfills it, instead of the gap silently becoming a wrong balance.

**The cost** is running and monitoring two ingestion paths instead of one, and reasoning about
their overlap. For money, a missed event is far more expensive than a duplicate one, and
duplicates are already harmless.

## Making reads fast without making them wrong

The customer-facing balance and portfolio APIs aggregate data from several sources, which is
slow. I cached that aggregation with **per-field TTLs** derived from how fast each value can
legitimately change, instead of one blanket expiry: a value that changes once a day is not
refetched every few seconds, and a value that changes constantly is never served stale for long.

## Shipping it

CI runs type-checks and the integration suite against a throwaway Postgres container on every
pull request. Merges build, validate configuration and deploy to AWS, with path filters and
concurrency gating so a newer push cancels a stale run instead of racing it.
