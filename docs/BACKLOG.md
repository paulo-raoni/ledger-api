# Backlog

Future ideas — not committed scope.

## M2 — Reliability

- Idempotency keys for duplicate transaction prevention
- Optimistic locking for concurrent balance updates
- ACID database transactions for critical operations
- Balance snapshots to avoid continuous aggregation at scale
- Integration tests with real database
- Concurrency stress tests

## M3 — Frontend Demo UI

- React + Vite in apps/web (port 3000)
- Three modes: autoplay, guided (step-by-step), playground
- Light/dark mode
- Calls ledger and identity APIs only — no shared packages
- Separate project — does not import @ledger/\* packages

## M4 — Observability Dashboard

- SSE or WebSocket event streaming in backend services
- Real-time flow visualization (blocks, arrows, idle/waiting/active states)
- Graphical view + terminal-style view
- Integrated into apps/web
