---
title: Finding where a read-heavy service actually breaks
kicker: Scalability, measured
org: Personal build, shortn
period: '2026'
order: 2
summary: A URL shortener in Go, load-tested with k6 against real Postgres and Redis until it broke. Every number is measured on one laptop, and the most useful findings are the bugs that only appeared under load.
stack: [Go, PostgreSQL, Redis, nginx, k6, Docker]
metrics:
  - { value: '37,893/s', label: 'redirects, p95 2.32 ms, 0 errors' }
  - { value: '12,141/s', label: 'writes, p95 6.41 ms, 0 errors' }
  - { value: '99.86%', label: 'of reads served from Redis' }
  - { value: '~570M', label: 'redirects/day at a 4x peak ratio' }
flow:
  - { label: 'Client', detail: 'GET /{code}' }
  - { label: 'nginx', detail: 'routes reads and writes to separate pools' }
  - { label: 'Read instance', detail: 'Redis first' }
  - { label: 'Postgres', detail: 'only on a miss, 0.14% of reads' }
  - { label: '302', detail: 'or 404' }
links:
  - { label: 'Shailu-s/shortn', href: 'https://github.com/Shailu-s/shortn' }
---

## The question

Not "can I build a URL shortener" but "where does a read-heavy service break, and is it where I
would have guessed". Every number below was measured with k6 and the service's own `/metrics`,
on one laptop running Postgres, Redis and the API together. No projections.

| Workload | Throughput | Median | p95 | p99 | Errors |
|---|---:|---:|---:|---:|---:|
| Read | 37,893/s | 1.06 ms | 2.32 ms | 3.85 ms | 0% |
| Write | 12,141/s | 3.77 ms | 6.41 ms | 9.70 ms | 0% |

After the read run, 1,056 database reads out of 770,619 requests. Everything else came from Redis.

## Codes from a counter, not randomness

Redis holds one counter. Each instance claims a block of 1,000 ids with a single `INCRBY` and
serves the rest from memory. Collisions are impossible by construction rather than merely
unlikely, and 999 of every 1,000 writes make no Redis call at all.

**The cost** is that sequential codes are guessable, and the gap between two codes leaks how many
links were created in between. So `protected: true` swaps in an 11-character `crypto/rand` code
for links that should not be walkable.

## Things that only showed up under load

- **The counter did not survive a Redis restart.** Redis runs as a cache with no persistence, so
  a restart reset the counter to zero and every insert then failed on the primary key. The fix
  reseeds it from `MAX(id)` in Postgres at startup, verified by `FLUSHALL` and a restart.
- **`noeviction` fails silently.** At full memory Redis refuses writes but keeps serving reads.
  The hit rate would decay toward zero and Postgres would take the full load with nothing
  logged. It has to be `volatile-lfu`, not `allkeys-lfu`, because the counter is touched once per
  1,000 writes and would be one of the first keys evicted.
- **An in-process cache in front of Redis made things worse.** It served 0 of 1.2M reads, cost
  write throughput, had no size bound and could not be invalidated across instances. Removing it
  took reads from 31,629/s to 38,233/s.
- **Connection pools are per process.** 50 connections is right for one binary and becomes 150
  across three, against a Postgres default of 100. 93.8% of writes failed the first time the
  split ran.

## Splitting reads from writes

Reads are 98.9% Redis and writes are 100% Postgres: opposite resource profiles in one process. A
`ROLE` flag splits the same binary into read and write instances behind nginx.

On one machine the split is **slower**: reads dropped from 37,125/s to 23,183/s, an extra hop and
four processes sharing one CPU. That was the expected result, and the reason to measure rather
than assume. The split buys independent scaling across machines, not local latency.

## What binds next

Not the write path: a billion links is about 1.2 writes/sec, four orders of magnitude of
headroom. The real limits are Redis memory, now capped and evicting, and the single instance.
