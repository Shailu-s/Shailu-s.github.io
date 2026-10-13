---
title: An exchange hot path, measured one layer at a time
kicker: Throughput, measured
org: Personal build, matching-engine
period: '2026'
order: 1.5
summary: A Go exchange core with a TCP gateway, a write-ahead journal, pre-trade risk and a price-time order book. Every layer is benchmarked on its own, so a headline number never hides what it leaves out.
stack: [Go, TCP, write-ahead log, fsync, Docker]
metrics:
  - { value: '500K/s', label: 'orders end to end, each durable before its ack' }
  - { value: '2-5M/s', label: 'orders through the matching core alone' }
  - { value: '~6 ms', label: 'p50 at a steady 50K orders/sec' }
flow:
  - { label: 'Gateway', detail: 'binary TCP, backpressure' }
  - { label: 'Sequencer', detail: 'single writer, batches' }
  - { label: 'Journal', detail: 'one fsync per batch' }
  - { label: 'Risk + match', detail: 'one thread, no locks' }
  - { label: 'Ack', detail: 'only after durable' }
links:
  - { label: 'Shailu-s/matching-engine', href: 'https://github.com/Shailu-s/matching-engine' }
  - { label: 'Live demo', href: 'https://matching-engine-ydj6.onrender.com' }
---

## The problem

A matching loop with orders already in memory runs at millions of orders per second. That
number is real and almost useless: it leaves out the network, the risk check, and the disk
write that makes an order survive a crash. A useful number has to include all of them, and
say what each one costs.

## The constraint that shaped it

**An acknowledged order must survive a crash.** So the order has to be on disk before the
reply goes out, and a disk flush takes milliseconds. Everything else in the design follows
from not letting that flush cap throughput.

## The design

- A **single-writer sequencer** stamps every command with a sequence number and batches
  whatever is waiting while the previous flush is in flight.
- The batch goes to an **append-only journal with one fsync for the whole batch**. That is
  group commit: hundreds or thousands of orders share one flush, so throughput is batch size
  divided by flush time, not one order per flush.
- A **single-threaded core** then reserves funds, matches with price-time priority and
  settles both sides of every fill. One thread means no locks and a deterministic result.
- The reply goes out only after the batch is both durable and applied.

## Measured layer by layer

| Layer added | Orders/sec, median of 3 runs |
|---|---|
| Matching only, one thread | 2.7M |
| + risk reserve and settlement | 1.5M |
| + sequencer and journal, no fsync | 0.9M |
| + fsync per batch | 467K |
| + TCP gateway, separate process | 413K |

Measured on an Apple M4 laptop with other workloads running; a quieter run reached 580K end to end. Fixed-rate runs measure latency from the scheduled send time,
so a stalled server cannot hide by slowing the client down.

## Recovery

The core has no clock and no randomness, so its state is a pure function of the journal.
After a `kill -9`, it loads the newest snapshot, replays the journal after it and truncates a
torn last record. A verifier rebuilds the state a second way, from the whole journal, and
compares SHA-256 hashes of the two. An automated test kills the real binary four times under
load and checks that no acknowledged order is ever lost.

## The cost

Latency. An order waits for the flush already in progress and then its own, so p50 sits near
one and a half flushes, about 6 ms, while matching itself takes well under a microsecond. The
p99 follows the disk: on macOS a flush occasionally stalls for tens of milliseconds, and
everything queued behind it waits. Production venues avoid that by replicating the journal to
another machine's memory and acknowledging on replication instead of on a local flush.

## What I left out on purpose

Kafka, Postgres and market-data fan-out. They read the output stream downstream; they add lag
for their readers, not latency to an order, so they don't belong in this measurement.
