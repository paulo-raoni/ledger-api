## M0 — Bootstrap

Status: ✅ complete

## M1 — Core Implementation

Status: ✅ complete

## M2 — Reliability

Status: ✅ complete

## M3 — Frontend Demo UI

Status: ✅ complete

## M4 — Observability Dashboard

Status: ✅ complete

PRs:

- PR 1 `fix/m3-bugs` (#25) — M3 bug cluster: POST schema, advisory-lock SQL, ApiError/NetworkError, runEmail regen, plugin-level idempotency hook, .gitignore split, .devcontainer commit, docs move.
- PR 2 `feat/m4-sse-endpoints` (#26) — GET /events on both services with per-user filter, `/events` + `/health` excluded from instrumentation, single close handler, manual CORS on `reply.raw.writeHead`.
- PR 3 `feat/m4-terminal-view` (#27) — Observability container + TerminalView + LogLine, 500-line FIFO, `sseStatusRef` for stable auth-error UX, viewport-aware default.
- PR 4 `feat/m4-graph-view` (#28) — ServiceBlock / DbBlock / Arrow, client `receivedAt` 2 s decay, cross-user defensive filter, keyframes in `index.css` only.
- PR 5 `feat/m4-polish` (#29) — CSS-only polish (padding, typography, separators, WCAG AA `text-muted`).
- PR 6 `feat/m4-reset-db` (#30) — DELETE /debug/reset with `?confirm=YES` safety rail + Reset DB modal in DB Inspector.
- PR 7 `test/m4-playwright` (#31) — 17 E2E tests for Observability + Reset DB, `page.waitForFunction` for SSE, 3-consecutive-run flakiness gate. Incidental fix for `/health` and `/debug/db` handlers (`res.json` → `reply` auto-serialise).
- PR 8 `chore/m4-governance` — this PR.
