# Decisions

| ID  | Decision                                                    | Date       |
| --- | ----------------------------------------------------------- | ---------- |
| D01 | Use knex for migrations, raw pg for queries                 | 2026-04-13 |
| D02 | Use SELECT FOR UPDATE (pessimistic locking)                 | 2026-04-13 |
| D03 | apps/web is a standalone workspace (no @ledger/\* imports)  | 2026-04-14 |
| D04 | Native fetch in apps/web (no axios, no external state mgr)  | 2026-04-14 |
| D05 | Debug endpoints gated by NODE_ENV !== 'production'          | 2026-04-14 |

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
