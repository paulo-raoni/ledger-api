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
- PR 8 `chore/m4-governance` (#32) — mark M4 complete, record D06, update backlog.

## M5 — Bug Fixes + UX Overhaul

Status: ✅ complete

PRs:

- PR 0 `docs/m5-spec` (#33) — move `m5-spec.md` + `m5-ralplan.md` under `docs/`; apply consensus amendments (filesystem-authority note, Fix 1d/1e promotion, Fix 2c SSE lift, PR 4 criterion downgrade, PR 5 consumer-only, pre-mortem scenario 6, §12 auto-merge override).
- PR 1 `fix/m5-backend-bugs` (#34) — amount unit D07 (integer cents end-to-end), Fix 1d `requestId` on every SSE envelope (`randomBytes(3).hex`, per-user filter + `/events` / `/health` hook exclusions preserved), demoFlow USD relabel, D06 amendment recorded in `docs/DECISIONS.md` (Fix 1e).
- PR 2 `fix/m5-frontend-bugs` (#35) — Playground accordion toggle, token pill refresh on `/auth`, SSE lifecycle lifted to `AppContext`, global `sse-auth-error` banner with reconnect pause, USD display via shared `formatAmount`, single-decimal latency format.
- PR 3 `feat/m5-header` (#36) — header redesign: `app-title`, two `health-dot-*` indicators polling `/health`, relocated `ThemeToggle` in top-right, mode tabs centered on row 2.
- PR 4 `feat/m5-graph-overhaul` (#37) — Client node, packet animation (CSS `offset-path` primary + `transform` translate fallback via `CSS.supports` feature-detect), block expand on packet arrival, playback LIVE/REPLAY with slow/medium/fast speed selector.
- PR 5 `feat/m5-terminal-overhaul` (#38) — tri-state Terminal (Pill / Default / Maximized), glow on new events, `[req-XXXXXX]` prefix + stable color rotation per `requestId` (consumer-only, field from PR 1 Fix 1d).
- PR 6 `feat/m5-autoplay-delay` (#39) — 800ms step delay module-constant, `▶ Replay in Graph` trigger on completion (Autoplay-side `replay-trigger-autoplay`, Observability-side `replay-trigger` preserved).
- PR 7 `test/m5-playwright` (#40) — 23 Playwright E2E tests across chromium / firefox / webkit, flake-free gate (3 consecutive full runs).
- PR 8 `chore/m5-governance` — this PR.
