# Decisions

| ID  | Decision                                    | Date       |
| --- | ------------------------------------------- | ---------- |
| D01 | Use knex for migrations, raw pg for queries | 2026-04-13 |
| D02 | Use SELECT FOR UPDATE (pessimistic locking) | 2026-04-13 |

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
