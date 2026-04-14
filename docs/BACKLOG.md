# Backlog

Future ideas — not committed scope.

## M4 — Observability Dashboard (next)

- SSE event streaming (`GET /events`) in ledger and identity services
- Real-time flow visualization: service blocks + DB blocks with animated arrows
- States: idle / active / waiting / error
- Toggle Graph | Terminal view (terminal = structured log stream with color coding)
- Integrated into apps/web as a fourth mode alongside Autoplay / Guided / Playground
- Complementary to M3's static DB Inspector (snapshot) — M4 is the live flow view

## Post-M3 refinements (captured from M3 critic review)

- Concurrent transactions stress test in Playground (two DEBITs via `Promise.all` to demonstrate SELECT FOR UPDATE lock ordering)
- `PATCH /users` with partial / empty body
- `GET /transactions?type=INVALID` → 400
- `Idempotency-Key` with invalid characters → 400
- Accessibility pass: contrast in light mode, keyboard nav in Playground, aria-labels
- `amount` float handling: `<input type="number">` can still accept decimals in some browsers; belt-and-braces client validation
- DB Inspector filter by current run's `user_id` vs. show-all toggle
