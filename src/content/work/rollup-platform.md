---
title: Provisioning a full production stack from one command
kicker: Platform & infrastructure
org: Tokamak Network
period: 2024 to 2026
order: 5
summary: A Go SDK and CLI that provisions cloud infrastructure, deploys a multi-service stack to Kubernetes, verifies it, and tears it down cleanly. Built so a failure halfway through never strands the operator.
stack: [Go, Kubernetes, Helm, Terraform, TypeScript, PostgreSQL, Prometheus, Grafana]
metrics:
  - { value: 'days → 1 cmd', label: 'manual setup replaced by the CLI' }
  - { value: '4', label: 'engineers led across SDK, backend, platform' }
  - { value: 'resumable', label: 'a failed deployment restarts from one command' }
flow:
  - { label: 'Provision', detail: 'cloud infrastructure' }
  - { label: 'Deploy', detail: 'service stack to Kubernetes via Helm' }
  - { label: 'Wire up', detail: 'networking, monitoring, explorers' }
  - { label: 'Register', detail: 'resumable, verified, with backoff' }
  - { label: 'Observe', detail: 'Prometheus and Grafana from day one' }
codeNote: This is Tokamak Network's product. The work is described here; see my GitHub for public code.
---

## The problem

Clients wanted their own dedicated, fully configured environment: a set of cooperating services,
networking between them, monitoring, and a public explorer. Before the SDK, standing that up was
days of manual work by someone who already knew every step.

## The constraint that shaped it

**A deployment that fails halfway must never leave the operator stuck.** Cloud provisioning,
Helm releases and external registration all fail independently and at the worst time. A tool
that only works on the happy path just moves the manual work to the failure case.

## The design

I built the SDK and CLI in Go. It provisions the cloud infrastructure, deploys the service stack
to Kubernetes with Helm, wires networking, monitoring and explorers, and can tear a deployment
down cleanly. I led a team of four across the SDK, backend and platform.

The **registration flow** is the part that had to survive failure. It is a multi-step sequence,
and it can **resume from a standalone command** if it breaks partway through. Each step has
verification checks so a bad deployment cannot pass as valid, and incremental timeouts with
backoff so a slow step retries instead of failing the whole flow.

**The cost** is that every step has to be idempotent and able to discover its own prior state,
which makes each one more work to write than a straight-line script. It is the right trade for
anything an operator runs against real infrastructure.

## The backend behind it

The platform's TypeScript backend handles authentication, the Postgres schema and access layer,
and every call out to external services. Those calls retry, and the handlers are idempotent, so a
flaky upstream failure cannot corrupt deployment state or get applied twice.

## Operating it

I owned observability in Prometheus and Grafana: service health, processing lag and deployment
lifecycle events. We used those dashboards to catch and diagnose live incidents, not to decorate
a wall. I also built a backup manager for deployed environments, with automated state and
database backups and a restore path.
