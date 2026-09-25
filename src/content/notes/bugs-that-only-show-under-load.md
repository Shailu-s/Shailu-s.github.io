---
title: Four bugs that only showed up under load
description: What load-testing a URL shortener to 37,893 requests per second found that no unit test would have.
date: 2026-09-25
tags: [Go, Redis, PostgreSQL, load testing]
---

I built [shortn](https://github.com/Shailu-s/shortn), a URL shortener in Go on Postgres and
Redis, to answer one question: where does a read-heavy service actually break? The throughput
numbers were interesting. The bugs were more interesting. None of them fail a unit test.

## 1. The counter did not survive a Redis restart

Short codes come from a counter in Redis. Each instance claims a block of 1,000 ids with one
`INCRBY`, so 999 of every 1,000 writes never touch Redis.

But Redis was configured as a cache, with no persistence. Restart it and the counter is zero
again, so the next insert collides with row 1 on the primary key, and so does every one after it.

The fix is to reseed the counter from `MAX(id)` in Postgres at startup. The lesson is broader: if
a value in a cache is not reconstructible from the source of truth, it is not a cache entry, it
is state, and it needs to be treated like state.

## 2. `noeviction` fails silently

Redis ships with `maxmemory-policy noeviction`. At full memory it refuses writes and keeps
serving reads. For a cache that is the worst of both: populating the cache starts failing, the
error is ignored because a failed cache write is "not fatal", the hit rate decays toward zero, and
Postgres quietly absorbs the full read load. Nothing is logged anywhere.

It has to be `volatile-lfu`, not `allkeys-lfu`. The id counter is touched once per 1,000 writes,
which makes it one of the coldest keys in the keyspace, so `allkeys` would evict it first. Only
the cached URLs carry a TTL, so only they are eligible.

## 3. The in-process cache made everything worse

An L1 map in front of Redis sounded obviously good. Measured, it served 0 of 1.2 million reads,
cost write throughput, had no size bound, and could not be invalidated once there was more than
one instance. Removing it took reads from 31,629/s to 38,233/s.

## 4. Connection pools are per process

`SetMaxOpenConns(50)` is a sensible number for one binary. Split that binary into three instances
and it is 150 connections against a Postgres default of 100. The first time the read/write split
ran, 93.8% of writes failed with "too many clients already".

## The pattern

Every one of these was a correct decision made in isolation that became wrong in combination:
with a restart, with memory pressure, with a second instance. Load testing is how you find the
combinations, and it is only useful if you measure one change at a time.
