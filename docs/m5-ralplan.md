# M5 Ralplan

**Repo:** /workspaces/ledger-api
**Spec:** m5-spec.md (root)

---

## Before you start

Read in this order:
1. `CLAUDE.md`
2. `docs/PROGRESS.md`
3. `docs/DECISIONS.md`
4. `docs/m4-spec.md`
5. `m5-spec.md` (full spec — all implementation decisions are there)

Verify state before any action:
```bash
unset GITHUB_TOKEN GH_TOKEN
git pull origin main
git status
docker compose up -d
```

---

## Critic instructions

Analyze the Architect's plan against `m5-spec.md`. Verify:

- **PR 1 before everything else:** amount unit change touches backend schema, usecase, and demoFlow — must be complete before any frontend PR that displays amounts.
- **PR 2 depends on PR 1:** currency formatting fix assumes D07 (cents) is already the canonical unit.
- **PR 4 depends on PR 2:** SSE reconnect fix (2c) must be in place before Graph packet animation can work reliably.
- **PR 5 depends on PR 4:** Terminal pill lives inside Observability container — Graph layout must be settled first.
- **PR 6 depends on PR 4:** Replay trigger requires `lastRunEvents` in AppContext, introduced in PR 4.
- **Sensitive paths:** PR 8 touches `docs/PROGRESS.md`, `docs/DECISIONS.md`, `docs/BACKLOG.md` — operator approved in this ralplan.
- **CSS constraint:** all `@keyframes` (packet-travel, terminal-glow) must be in `index.css` only — not inline style attributes.
- **Pre-mortem:**
  1. Packet animation `offset-path` on SVG may not work in all Chromium versions — fallback to `translateX/Y` transform animation along a fixed axis if `offset-distance` is unsupported.
  2. Block auto-collapse `setTimeout` leaks if component unmounts before 2s — must clear timeout in cleanup.
  3. SSE lifted to AppContext means the connection opens as soon as a token exists, even if user never visits Observability — confirm this is acceptable (it is: low overhead, improves reliability).
  4. Replay `setTimeout` chain must be cancellable — store timeout IDs and clear them on Stop or unmount.
  5. Amount unit change (D07) is a breaking change for any existing data in the DB — Reset DB must be run after PR 1 merge before E2E tests.
  6. `offset-path` / `motion-path` / `offset-distance` support is uneven across chromium/firefox/webkit as of 2026 — feature-detect via `CSS.supports('offset-path', 'path("M 0 0")')`; fallback keyframe animates `transform: translate(...)` along a fixed axis, defined in `apps/web/src/index.css`. Playwright assertion targets testid presence + computed `animation-duration`, not visual motion; matrix covers all 3 browser projects.

---

## PR sequence

| PR | Branch | Title |
|---|---|---|
| 0 | `docs/m5-spec` | `docs(m5): add consolidated M5 spec` |
| 1 | `fix/m5-backend-bugs` | `fix(m5): amount unit, Reset DB endpoint confirm param` |
| 2 | `fix/m5-frontend-bugs` | `fix(m5): accordion toggle, token pill, SSE reconnect, currency, latency format` |
| 3 | `feat/m5-header` | `feat(web): header redesign — title, health dots, dark mode toggle` |
| 4 | `feat/m5-graph-overhaul` | `feat(web): Graph view — packet animation, block expand, Client node, playback` |
| 5 | `feat/m5-terminal-overhaul` | `feat(web): Terminal — pill/default/maximized states, glow, request ID prefix` |
| 6 | `feat/m5-autoplay-delay` | `feat(web): Autoplay step delay + Replay in Graph trigger` |
| 7 | `test/m5-playwright` | `test(web): Playwright E2E for M5 changes` |
| 8 | `chore/m5-governance` | `chore(m5): PROGRESS.md M5 ✅, DECISIONS.md D07/D08, BACKLOG.md` |

---

## Merge strategy — fully automated, no human gate

After each PR:
1. `npm run typecheck && npm run lint && npm test`
2. `/ask codex "Review PR [branch] against docs/m5-spec.md. Check: spec compliance, data-testid presence, no forbidden imports (axios, @ledger/* in apps/web, animation library), all @keyframes in index.css only, TypeScript/JS strict mode. LGTM or issues."`
3. All pass → `gh pr merge --merge --delete-branch`
4. `git checkout main && git pull` → next PR immediately in same turn

Fallback: if Codex unavailable, Critic reviews — do not block.
Operator does not confirm between PRs.

---

## Operator approvals recorded in this ralplan

- **PR 8:** editing `docs/PROGRESS.md`, `docs/DECISIONS.md`, `docs/BACKLOG.md` — sensitive paths approved.
- **§12 auto-merge override (M5 only):** Operator explicitly authorizes automated `gh pr merge --merge --delete-branch` for PRs 0–8 of milestone M5, superseding `CLAUDE.md` §12 for this milestone only. Recorded 2026-04-15. If operator revokes this override, fall back to human-gated merges per §12.
- **PR 1 Fix 1e:** editing `docs/DECISIONS.md` to record the D06 reconnect-pause amendment — sensitive path approved.
