---
title: Forward-secret messaging over relays that cannot read it
kicker: Networking & cryptography
org: Personal build, p2p-chat
period: '2026'
order: 6
summary: A peer-to-peer messaging node in Go. Messages route over gossip, get stored for peers that were offline, and are end-to-end encrypted with a Double Ratchet, so stealing one key opens exactly one message.
stack: [Go, libp2p, gossipsub, X25519, HKDF, Double Ratchet]
metrics:
  - { value: '31', label: 'tests, no network needed' }
  - { value: '1', label: 'message opened per stolen key' }
  - { value: '4', label: 'real bugs found and written up' }
flow:
  - { label: 'Encrypt', detail: 'fresh key per message, Double Ratchet' }
  - { label: 'Gossip', detail: 'no destination address on the wire' }
  - { label: 'Store', detail: 'relays keep ciphertext they cannot read' }
  - { label: 'Reconnect', detail: 'peer book redials continuously' }
  - { label: 'Sync', detail: 'opaque per-peer cursor' }
links:
  - { label: 'Shailu-s/p2p-messenger', href: 'https://github.com/Shailu-s/p2p-messenger' }
---

## The problem

Gossip only reaches nodes that are online. A real messaging network also has to deliver to
people who were offline, through relays that should learn nothing: not the content, and ideally
not who it was for.

## Scope, on purpose

This is not a full production messenger. Spam protection and peer-discovery hardening are deliberately out.
The aim was depth on the three hard parts: store-and-forward, forward-secret encryption, and the
relay, store and filter split.

## Four layers, each fixing the last one's problem

- **Transport and routing.** libp2p and gossipsub. A node forwards to its peers and a seen-cache
  stops loops. A persistent peer book redials known peers continuously, because in P2P rejoining
  is an ongoing effort, not a startup step.
- **Encryption.** X25519 for the shared secret, then a Double Ratchet. Every message gets a fresh
  key from a one-way chain, and each round trip mixes in new DH material.
- **Store-and-forward.** Every node stores what it relays. A node that was offline asks a peer
  for what it missed. Relays hold ciphertext under pairwise content topics, so a store node can
  serve history it can neither read nor attribute.
- **Light clients.** A node that does not want to join gossip subscribes to selected topics over
  a filter protocol, or asks for all topics so its narrower interest is not revealed.

## Bugs worth reading

- **The sync cursor could not be a timestamp.** Timestamps are the receiver's clock on purpose,
  so a lying sender cannot forge ordering. That makes them useless for paging across nodes. The
  fix is an opaque per-peer cursor the client stores and never interprets.
- **A security test that passed for the wrong reason.** The test bounding skipped message keys
  never reached its check, because the forged header defaulted `N` to 0. It failed a different
  assertion and looked green. A security test that never reaches the check it names is worse
  than no test.
- **Inbound connections record the wrong address.** The remote address on an inbound connection
  is the peer's ephemeral source port, which nothing listens on. The peer book waits for libp2p
  identify to report the real listen address before saving.
- **Persisting ratchet state weakens the guarantee.** Keys that would be gone from memory have to
  survive on disk, or stored messages become unreadable after a restart. Resolved in favour of
  availability, with state encrypted at rest and **the cost stated rather than hidden**.
