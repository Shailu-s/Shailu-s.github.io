export const profile = {
  name: 'Shailendra Singh',
  title: 'Senior Backend Engineer',
  tagline:
    'I build distributed backend systems that stay correct under load, retries and partial failure: ledgers, event pipelines, deadline-bound services, and the infrastructure they run on.',
  location: 'Bangalore, India',
  email: 'srajawat024@gmail.com',
  links: {
    github: 'https://github.com/Shailu-s',
    linkedin: 'https://linkedin.com/in/shailendrasinghw3',
  },
};

export const resumes = [
  { label: 'Resume', file: '/resume/Shailendra-Singh-Backend.pdf', note: 'One page, PDF' },
];

export type Role = {
  company: string;
  title: string;
  period: string;
  place: string;
  summary: string;
  points: string[];
  tags: string[];
};

export const experience: Role[] = [
  {
    company: 'Qiro Finance',
    title: 'Senior Backend Engineer',
    period: '04/2026 to present',
    place: 'Bengaluru',
    summary: 'Fintech, private credit. I own the backend of the revolving credit product.',
    points: [
      'Designed the accounting system behind a revolving line of credit: borrowing, repayment, missed payment and recovery as an explicit state machine over an append-only ledger.',
      'Made the money math provably correct: arbitrary-precision integers instead of floats, deterministic replay from the event log, and invariants enforced as database constraints so two workers racing on one event cannot both commit.',
      'Built event ingestion from two independent sources, push webhooks plus a polling scanner, with idempotent writes and automatic gap detection and backfill, so no event is lost or applied twice.',
      'Cut latency on customer-facing balance APIs by caching an expensive multi-source aggregation, with per-field TTLs set by how fast each value can legitimately change.',
      'Built CI/CD in GitHub Actions: integration tests against an ephemeral Postgres container on every PR, automatic deploys to AWS on merge, and concurrency gating so stale runs cancel instead of racing.',
    ],
    tags: ['TypeScript', 'Go', 'PostgreSQL', 'Docker', 'GitHub Actions', 'AWS'],
  },
  {
    company: 'Tokamak Network',
    title: 'Senior Backend Engineer',
    period: '07/2024 to 03/2026',
    place: 'Remote',
    summary: 'Infrastructure platform. Led a team of four across SDK, backend and platform.',
    points: [
      'Built a Go SDK and CLI that provisions cloud infrastructure, deploys a full service stack to Kubernetes with Helm, wires networking, monitoring and explorers, and tears it down cleanly. Replaced days of manual setup.',
      'Made the multi-step deployment flow resumable from a standalone command, with verification checks and incremental backoff, so a failure halfway through no longer strands an operator.',
      'Built the TypeScript backend behind the platform: auth, the Postgres schema and access layer, and retries with idempotent handlers so a flaky upstream cannot corrupt deployment state.',
      'Owned observability in Prometheus and Grafana, and used those dashboards to diagnose live incidents rather than only to display metrics.',
    ],
    tags: ['Go', 'TypeScript', 'Kubernetes', 'Helm', 'Terraform', 'PostgreSQL', 'Prometheus'],
  },
  {
    company: 'Syvora',
    title: 'Software Engineer',
    period: '12/2020 to 07/2024',
    place: 'Remote',
    summary: 'Backend consultancy. Long engagements on a derivatives exchange and on a real-time auction system for Blockswap Labs.',
    points: [
      'Built the core of a deadline-bounded auction in Go: concurrent fan-out to many upstreams under a hard 12-second window, returning the best answer received when the deadline fires. Tuned the cutoff from real latency data, raising the hit rate from 94% to 99.5%.',
      'Designed that system as independent modules over gRPC so new providers plug in without touching core logic, and debugged real goroutine races in the fan-out path.',
      'Built a real-time order matching engine in Go on an in-memory order book, keeping disk off the hot path with async persistence and crash recovery by replay.',
      'Built event pipelines on RabbitMQ into PostgreSQL and MongoDB, high-concurrency workers for order management and settlement, and peer-to-peer state sync with leader election.',
      'Built serverless analytics on AWS Lambda feeding a SQL database behind an internal reporting dashboard.',
    ],
    tags: ['Go', 'TypeScript', 'gRPC', 'RabbitMQ', 'PostgreSQL', 'MongoDB', 'AWS Lambda'],
  },
];

export type Repo = { name: string; href?: string; lang: string; blurb: string; status?: string };

export const openSource: Repo[] = [
  { name: 'shortn', href: 'https://github.com/Shailu-s/shortn', lang: 'Go', blurb: 'URL shortener load-tested until it broke. 37,893 requests/s measured, and the bugs that only showed up under load.' },
  { name: 'payments-platform', href: 'https://github.com/Shailu-s/payments-platform', lang: 'Go', blurb: 'Money movement through unreliable providers on a double-entry ledger. Eight guarantees, each backed by a test.', status: 'in design' },
  { name: 'p2p-messenger', href: 'https://github.com/Shailu-s/p2p-messenger', lang: 'Go', blurb: 'Peer-to-peer messaging node: gossip routing, store-and-forward for offline peers, end-to-end encryption. 31 tests.' },
  { name: 'order-execution-service', href: 'https://github.com/Shailu-s/order-execution-service', lang: 'TypeScript', blurb: 'Conditional order engine (stop-loss, take-profit, stop-limit) driven by a WebSocket price feed. 99 tests.' },
  { name: 'Matching-engine-orderbook', href: 'https://github.com/Shailu-s/Matching-engine-orderbook', lang: 'Go', blurb: 'Order book that matches buys and sells with partial fills, order queues and persistence.' },
  { name: 'card-engine', lang: 'Go', blurb: 'Card authorization against a reservation ledger inside a 2-second budget, with batched settlement and reconciliation.', status: 'in progress' },
];

export const stack = [
  { group: 'Languages', items: ['Go', 'TypeScript', 'Python', 'Rust', 'SQL'] },
  { group: 'Backend & data', items: ['PostgreSQL', 'Redis', 'MongoDB', 'RabbitMQ', 'gRPC', 'REST', 'WebSockets', 'NestJS', 'Django'] },
  { group: 'Infrastructure', items: ['Docker', 'Kubernetes', 'Helm', 'Terraform', 'AWS', 'GCP', 'GitHub Actions'] },
  { group: 'Reliability', items: ['Prometheus', 'Grafana', 'k6 load testing', 'idempotency', 'caching', 'distributed systems'] },
];
