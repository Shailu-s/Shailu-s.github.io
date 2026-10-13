---
title: Real-time order matching with disk off the hot path
kicker: Low latency
org: Syvora, derivatives exchange
period: 2020 to 2024
order: 1
summary: A Go matching engine on an in-memory order book. Matching never waits on a write; persistence happens asynchronously downstream, and the book is rebuilt by replay after a crash.
stack: [Go, PostgreSQL, MongoDB, RabbitMQ, TypeScript]
metrics:
  - { value: '45K+/s', label: 'orders matched, benchmarked' }
  - { value: 'Batched', label: 'on-chain settlement of matched orders' }
  - { value: '<1 ms', label: 'match latency' }
flow:
  - { label: 'Order in', detail: 'signed and validated' }
  - { label: 'Match', detail: 'in-memory price-level book' }
  - { label: 'Emit fills', detail: 'onto a queue' }
  - { label: 'Persist', detail: 'workers write asynchronously' }
  - { label: 'Settle', detail: 'downstream, batched' }
links:
  - { label: 'Shailu-s/Matching-engine-orderbook', href: 'https://github.com/Shailu-s/Matching-engine-orderbook' }
  - { label: 'Shailu-s/p2p-relayer', href: 'https://github.com/Shailu-s/p2p-relayer' }
---

## The problem

An exchange has to match orders fast enough that nobody notices, and it has to never lose a fill.
Those two pull against each other: the durable way to record a fill is a disk write, and a disk
write in the matching loop puts storage latency on every single order.

## The constraint that shaped it

**Matching must never wait on storage.** Durability still matters, but it has to happen somewhere
other than the hot path.

## The design

- The matching engine in Go holds an **in-memory price-level order book** with order queues at
  each level and partial fills.
- Matched fills are emitted onto a queue. **Workers persist them asynchronously** into PostgreSQL
  and MongoDB through RabbitMQ pipelines, and handle order management and settlement downstream.
- On restart, the engine **rebuilds the book by replaying persisted order history**.

That keeps match latency under a millisecond, and the matcher was benchmarked at **more than
45,000 trades per second**.

## The cost

The in-memory book is not the durable record. Recovery time grows with history, and there is a
window where a crash loses in-flight state that has not yet been written. That is acceptable here
because settlement, not the matcher, is the record of truth: an order that never settled never
moved money, and it can be resubmitted.

## Running on more than one node

Several nodes ran the matcher. Peer-to-peer state sync with **leader election** kept them
consistent without a central coordinator.

## What actually bound throughput

The matcher was never the bottleneck in production. Matched orders were **settled on-chain in
batches**, so throughput was bounded by gas limits and how many orders fit in each batch rather
than by matching. Making the matcher faster
would have changed nothing a user could see. The work that mattered was batching settlement well.
That is the most useful lesson from this system: measure the whole path before optimising the
part that is fun to optimise.
