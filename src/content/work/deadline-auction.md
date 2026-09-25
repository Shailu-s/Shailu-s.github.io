---
title: A deadline-bounded auction under a 12-second window
kicker: Concurrency & latency
org: Syvora, for Blockswap Labs
period: 2022 to 2024
order: 4
summary: The core auction path of a latency-sensitive Go service. It fans out requests to many upstreams at once and must return the best answer it has when the deadline hits, because a late answer is worth nothing.
stack: [Go, goroutines, context, gRPC, AWS Lambda, SQL]
metrics:
  - { value: '12 s', label: 'hard window, missing it wastes the round' }
  - { value: '94% → 99.5%', label: 'hit rate after moving the cutoff' }
  - { value: '~5%', label: 'late bids traded away for it' }
flow:
  - { label: 'Round starts', detail: 'a caller needs an answer' }
  - { label: 'Fan out', detail: 'one goroutine per upstream' }
  - { label: 'Collect', detail: 'bids arrive on a channel' }
  - { label: 'Deadline fires', detail: 'context cancels stragglers' }
  - { label: 'Return best', detail: 'highest bid received so far' }
codeNote: This was client work for Blockswap Labs. The design is described here; the client code is not mine to publish.
---

## The problem

Every 12 seconds the system runs an auction: ask many independent upstream providers for a bid,
pick the best one, and hand it back to the caller. The caller cannot wait. If the auction has
not answered inside the window, the round is wasted outright. There is no partial credit for a
better answer that arrives late.

Upstreams vary wildly. Most answer quickly, some are slow, some time out, some return garbage.

## The constraint that shaped it

**A slow upstream must never be able to make the whole auction miss.** Waiting for everyone is
not an option, so the question is not "how do I get every bid" but "what is the best answer I
can give at the deadline".

## The design

- Each upstream request runs in its own goroutine. Results come back on a channel.
- The whole round runs under a `context` with a deadline. When it fires, outstanding requests
  are cancelled and the auction returns **the best bid received so far**.
- A slow upstream simply loses its bid for that round. It does not delay anyone else.

The service is a set of independent modules talking over **gRPC** through a core service, so a
new provider integration plugs in without touching the auction logic. **The cost** is
inter-process overhead on every call, accepted in exchange for isolation.

## Tuning the cutoff with real data

The first version stopped collecting 10 seconds into the window, and the hit rate sat at 94%. I
analysed real latency distributions to find a better cutoff.

Moving the cutoff to **8 seconds** gave up about **5% of late-arriving bids** and raised the hit
rate to **99.5%**. That is the whole trade-off in one line: a slightly worse best bid on a few
rounds, in exchange for almost never missing one. A missed round is wasted outright, so it was
not close.

## Races

The fan-out and fan-in path had real goroutine races, and I debugged them in that path. It is the
classic shape for them: many senders, one collector, and a cancellation that can land while
responses are still arriving.

## The analytics side

For the same client I built independent AWS Lambda functions, triggered off upstream events,
tracking participant uptime, throughput and performance into a SQL database behind an internal
reporting dashboard.
