---
title: The sync cursor could not be a timestamp
description: Paging message history across P2P nodes, and why the obvious cursor silently drops messages at page boundaries.
date: 2026-09-25
tags: [P2P, distributed systems, Go]
---

In [p2p-chat](https://github.com/srajawat-hub/p2p-chat), a node that was offline reconnects and
asks a peer for the messages it missed, one page at a time. The obvious cursor for "give me
everything after here" is a timestamp. It is wrong.

## Whose clock?

Message timestamps in this design are the **receiver's** clock, deliberately. If the sender's
clock were trusted, a malicious sender could forge ordering by lying about time.

That makes a timestamp meaningful only on the node that assigned it. When node C asks node B for
"everything after 10:04:31", it is comparing its own clock against B's. The two drift. Depending
on which way, messages at the page boundary are either skipped or delivered twice, and nothing
errors.

## Opaque cursors

The fix is that the cursor belongs to the server, not the client. B hands C a token that marks a
position in B's store. C stores it per peer, per topic, and sends it back on the next request. C
never parses it, compares it, or reuses it with another peer.

It is the same idea as pagination tokens in most public APIs: the
only party that can interpret a position is the one that owns the ordering.

## The general rule

A value is only a valid cursor if the side interpreting it is the side that generated it. Clock
time across machines fails that test. So does an auto-increment id from a different replica. When
a cursor has to cross a trust or clock boundary, make it opaque.
