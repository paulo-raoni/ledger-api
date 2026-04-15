# Backlog

Future ideas — not committed scope.

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
