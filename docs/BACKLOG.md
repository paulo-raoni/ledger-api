# Backlog

Future ideas — not committed scope.

## Post-M5 refinements (captured from M5 consensus review)

- **User-configurable Autoplay step delay.** `STEP_DELAY` is currently a hard-coded 800ms module constant in `apps/web/src/modes/Autoplay.tsx`. Expose it as a slider (range 200–3000ms) on the Autoplay footer so operators demoing at conferences can pace the narrative live.
- **Replay scrubber.** REPLAY mode currently plays `lastRunEvents` start-to-finish at the selected speed with only a `replay-stop` control. Add a scrubber bar that seeks within `lastRunEvents` (click-to-jump, drag-to-scrub) plus pause/resume mid-replay.
- **DB block `balance_after` field.** The DB block in Graph view currently renders the post-transaction balance as a placeholder and infers the delta from the request path (±$30.00 DEBIT/CREDIT). Reason: the SSE envelope does not carry post-transaction balance. Add a `balance_after` (cents) field to the ledger `db` event shape emitted from `createTransaction.timedDb`, then render it directly on the DB block.
- **Revisit `requestId` width.** `requestId` is 6 hex chars (2^24 ≈ 16M space) from `crypto.randomBytes(3).toString('hex')`. Sufficient for a single-operator demo. If multi-operator scenarios emerge where multiple sessions share a terminal view, bump to `randomBytes(4)` (8 hex, 2^32) and re-verify the color rotation still reads cleanly.
- **CI flake-free gate: 3 consecutive full runs per browser.** PR 7 gates flake-free manually (operator runs the suite three times on merge). Wire this into CI so each of chromium / firefox / webkit runs the full M4 + M5 suite three times before green.
- **Multi-currency support (D08 follow-up).** API shape `{ amount_cents: number, currency_code: string }` (ISO 4217); client-side formatter keyed off `currency_code`. Drops the USD hard-code in `apps/web/src/lib/format.ts` in favor of a per-event currency lookup.
- **Unify `apps/web` test runner.** `apps/web/src/**/*.test.ts` files exist in-tree (e.g., `sseLifecycle.test.ts`, `replay.test.ts`, `LogLine.test.ts`, `deriveServiceState.test.ts`) but are not wired to `npm test`. Decide on jest vs vitest, add the runner config to `apps/web`, and include the workspace in the root `npm test` orchestration so these tests actually execute under the CI gate.

## Post-M4 refinements (captured from M4 consensus review)

- **D02 refinement — pessimistic lock via `balance_snapshots.version`.** Current advisory-lock approach (`pg_advisory_xact_lock(hashtext(user_id))`) works at demo scale. For production, wire `balance_snapshots` as the pessimistic lock row (one `SELECT … FOR UPDATE` on the snapshot row, then compute/insert inside the same transaction). Also note `hashtext` is int4 (32-bit) and has a small but non-zero collision surface under high user counts — production should prefer `hashtextextended` (int8) or the snapshot-row approach.
- **SSE backpressure policy.** `reply.raw.write` return value is currently ignored — a slow client blocks a Node event-loop tick per write. Add a buffer or drop policy.
- **Observability metric: `sse_clients_connected` gauge.** Expose via a metrics endpoint rather than structured logs only; makes cleanup verifiable in prod-like envs.
- **Production SSE auth path.** Replace query-param JWT (demo-only) with cookie-based (HttpOnly, SameSite=Strict) or short-lived SSE ticket exchanged via authenticated POST.
- **Silent SSE re-auth on token rotation.** Current behaviour is "stream terminates, user refreshes". A production implementation should reconnect with a refreshed token without user intervention.
- **Cross-origin headers on SSE via `reply.raw.writeHead`.** Currently set manually to bypass the Fastify CORS plugin's `onSend` hook — consider a dedicated plugin that writes the correct CORS for streaming endpoints.

## Post-M3 refinements (captured from M3 critic review)

- Concurrent transactions stress test in Playground (two DEBITs via `Promise.all` to demonstrate SELECT FOR UPDATE lock ordering)
- `PATCH /users` with partial / empty body
- `GET /transactions?type=INVALID` → 400
- `Idempotency-Key` with invalid characters → 400
- Accessibility pass: contrast in light mode, keyboard nav in Playground, aria-labels
- `amount` float handling: `<input type="number">` can still accept decimals in some browsers; belt-and-braces client validation
- DB Inspector filter by current run's `user_id` vs. show-all toggle
