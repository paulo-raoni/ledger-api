# Decisions

| ID  | Decision                                                    | Date       |
| --- | ----------------------------------------------------------- | ---------- |
| D01 | Use knex for migrations, raw pg for queries                 | 2026-04-13 |
| D02 | Use SELECT FOR UPDATE (pessimistic locking)                 | 2026-04-13 |
| D03 | apps/web is a standalone workspace (no @ledger/\* imports)  | 2026-04-14 |
| D04 | Native fetch in apps/web (no axios, no external state mgr)  | 2026-04-14 |
| D05 | Debug endpoints gated by NODE_ENV !== 'production'          | 2026-04-14 |
| D06 | SSE via native EventSource + query-param JWT auth (M4)      | 2026-04-15 |

## D01 — Knex for migrations, raw pg for queries

**Context:** M2 needed versioned, reversible database migrations. The codebase already used the `pg` driver directly for all repository queries.

**Decision:** Add knex as the migration framework. Keep raw pg Pool for application queries. Two database abstractions coexist intentionally.

**Alternatives rejected:**

- **Prisma / TypeORM:** Require TypeScript or code generation. Massive dependency for 3 tables. Overkill.
- **Raw SQL migrations (status quo):** No versioning, no rollback, no migration history tracking.
- **Knex query builder for everything:** Would require rewriting all repositories. Out of scope for M2.

**Consequences:**

- Knex pool configured with `min: 0, max: 2` (migrations only, runs once at startup).
- Developers must understand both abstractions. Documented as intentional in ADR.
- Future milestone may unify on knex query builder if warranted.

## D02 — SELECT FOR UPDATE (pessimistic locking)

**Context:** M2 required concurrency control for financial transactions. Two concurrent DEBIT requests for the same user must not both succeed when balance is insufficient.

**Decision:** Use `SELECT ... FOR UPDATE` within a `BEGIN/COMMIT` transaction. This locks all transaction rows for the user during balance computation and modification.

**Alternatives rejected:**

- **Optimistic locking (version column):** Requires retry loops in application code. More complex, harder to prove correct.
- **Advisory locks:** More complex API, no row-level granularity for this use case.

**Trade-offs:**

- FOR UPDATE on the flat `transactions` table is O(n) per user — it locks every row. A production system would lock a single `accounts` or `balance_snapshots` row instead (O(1)).
- `statement_timeout = 5000ms` prevents indefinite blocking. On timeout, the transaction rolls back and returns 503.
- Acceptable for the demo. The flat model is a deliberate principle choice (no accounts table).

## D03 — apps/web is a standalone workspace (no @ledger/\* imports)

**Context:** M3 introduced a frontend (`apps/web`) that calls the identity and ledger services. Reusing `@ledger/shared` for request/response types would couple the frontend's bundle to backend-only concerns (pg, knex, JWT signing).

**Decision:** `apps/web` does not import from any `@ledger/*` workspace package. It redefines the types it needs locally and treats both services as external HTTP APIs.

**Alternatives rejected:**

- **Import `@ledger/shared` types:** Pulls backend transitive deps into the frontend bundle and blurs the service boundary that the demo is trying to illustrate.
- **Extract a third `packages/contracts` workspace:** Premature — only one consumer, and the OpenAPI specs already serve as the contract of record.

**Consequences:**

- Types in `apps/web` may drift from the services. OpenAPI specs (`docs/openapi/*.yaml`) are the source of truth; review them when editing frontend types.
- Frontend has zero backend code in its bundle.

## D04 — Native fetch in apps/web (no axios, no external state manager)

**Context:** M3 needed an HTTP client and cross-component state (token, userId, history). The demo's pedagogical goal is to show what a real integration looks like, not to showcase framework choices.

**Decision:** Use the platform `fetch` API for all HTTP and React Context for state. No axios, no Zustand / Redux / TanStack Query, no animation library, no UI library.

**Alternatives rejected:**

- **axios:** Extra dependency, extra surface area, no feature we need that `fetch` lacks.
- **Zustand / Redux:** Overkill for two slices of state (session + history).
- **TanStack Query:** Would obscure the raw request/response pair that the demo is meant to highlight.

**Consequences:**

- Smaller bundle, fewer moving parts.
- A little boilerplate in API wrappers (AbortController for timeouts, manual JSON parsing) — intentional, the demo is meant to show the primitives.

## D05 — Debug endpoints gated by NODE_ENV !== 'production'

**Context:** M3 required `/debug/db` on both services so the DB Inspector could show live table contents. This endpoint returns every row of every user table, which is unacceptable in production.

**Decision:** Register `/debug/db` only when `process.env.NODE_ENV !== 'production'`. `/health` stays unconditional.

**Alternatives rejected:**

- **Auth-gated debug endpoint:** Any shared secret becomes a liability and complicates the demo. The route simply must not exist in prod.
- **Separate debug service:** Extra process, extra port, extra docker-compose entry for zero benefit in a demo.

**Consequences:**

- In any prod-like deployment, the DB Inspector will show an "unreachable" message — this is the intended failure mode.
- Integration tests run with `NODE_ENV` unset, so the route is available to them.

## D06 — SSE via native EventSource + query-param JWT auth (M4)

**Context:** M4 needed a near-real-time observability stream from both services to drive the dashboard. The browser must subscribe to events as they happen (no polling), within the existing dev topology (no new infrastructure).

**Decision:** Expose `GET /events` on both `ms-ledger` and `ms-identity` as Server-Sent Events. Clients connect with the native `EventSource` API. JWT is passed as `?token=<jwt>` because `EventSource` cannot set headers. A per-service in-process `EventEmitter` fans events out; the handler's `send` callback filters by `event.userId !== request.user.sub` to enforce per-user isolation. `/events` and `/health` are excluded from the instrumentation hooks to prevent feedback loops.

**Alternatives rejected:**

- **WebSocket (`ws`, `socket.io`):** bidirectional is overkill for a one-way observability stream; adds a library dependency and a protocol upgrade.
- **Long-polling:** higher latency, more HTTP overhead, more client code for correct close/retry.
- **External message bus (Redis pub/sub, NATS):** external dependency for an in-process fan-out in a single replica per service.
- **Cookie-based auth (HttpOnly, SameSite=Strict):** requires CSRF handling and same-origin setup that the current dev topology (3000 → 3001/3002) does not provide. Noted as the production-appropriate path.
- **Short-lived SSE ticket exchanged via authenticated POST:** more correct but more code than the milestone scope justifies. Also a production-path candidate.

**Consequences:**

- JWT appears in access logs, browser history, and any intermediate proxy that logs URLs. **Not suitable for production.**
- Token rotation (re-login, expiry) terminates the stream. The client surfaces a distinct `sse-auth-error` state; the user must refresh. `EventSource` auto-reconnect re-sends the same query param, so an expired token causes a permanent reconnect loop until the page is refreshed.
- Per-user isolation depends on the `send` filter. Server-side filter is primary; the graph-view client also filters by `userId` defensively.
- No backpressure control — a slow client blocks a Node event-loop tick per write. Acceptable for a single-operator demo (see Backlog).
- `/events` and `/health` routes are excluded from `onRequest` / `onResponse` / `onError` instrumentation hooks to prevent feedback loops.

**Trade-offs:**

- Advisory lock for concurrency: `pg_advisory_xact_lock(hashtext(user_id))` is used by `createTransaction` in place of the previous buggy `FOR UPDATE + SUM`. `hashtext` returns int4 (32-bit) — acceptable at demo scale; at production scale the snapshot-row approach (see Backlog) is the correct path.

**Follow-ups (backlog):**

- Production auth path: cookie-based (HttpOnly, SameSite=Strict) or short-lived SSE ticket exchange.
- SSE backpressure: buffer or drop policy for slow consumers.
- `balance_snapshots` as pessimistic lock row (D02 refinement).
- Observability metric: `sse_clients_connected` gauge exposed via a metrics endpoint.

**D06 Amendment (2026-04-15):** When `sse-auth-error` state is active in AppContext (M5 PR 2 Fix 2c), both EventSource connections pause — they are closed and not reconnected — until the user refreshes the page. This is an intentional opt-out of D06's original "permanent reconnect loop" behavior, required to prevent an app-wide reconnect storm once the SSE connection is lifted from `Observability` to global `AppContext` scope. The `sse-auth-error` banner is the user-visible signal. Rationale: lifting SSE to AppContext (per M5 Fix 2c) means the reconnect loop now runs app-wide from the moment a token exists, so an expired token would produce a cross-tab reconnect storm. Pausing on auth-error limits that blast radius while preserving the original per-user filter and hook-exclusion guarantees.
