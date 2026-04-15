# M5 Spec — Bug Fixes + UX Overhaul

**Milestone:** M5
**Depends on:** M4 ✅
**Base branch:** main
**Author:** Paulo Raoni (generated via claude.ai, 2026-04-15)

---

## Read before anything

In this order before writing any code:
1. `CLAUDE.md`
2. `docs/PROGRESS.md`
3. `docs/DECISIONS.md`
4. `docs/openapi/ms-identity.yaml` and `docs/openapi/ms-ledger.yaml`
5. `docs/m4-spec.md`
6. This spec in full

---

## Architectural decisions — M5 adds D07 and D08

| ID | Decision |
|---|---|
| D01 | Knex for migrations, raw pg for queries |
| D02 | SELECT FOR UPDATE (pessimistic locking) on balance_snapshot |
| D03 | apps/web standalone — no `@ledger/*` imports |
| D04 | Native fetch + React Context — no axios, Redux, animation lib, UI lib |
| D05 | `/debug/db` and `/debug/reset` gated by `NODE_ENV !== 'production'` |
| D06 | SSE via native `EventSource` — no library, no polling, auto-reconnect by browser |
| D07 | Amount unit is cents (integer). Frontend always divides by 100 for display. demoFlow amounts are in cents. |
| D08 | Currency display is USD (`$`). `Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })` everywhere. |

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
| 6 | `feat/m5-autoplay-delay` | `feat(web): Autoplay step delay + Observability co-visibility` |
| 7 | `test/m5-playwright` | `test(web): Playwright E2E for M5 changes` |
| 8 | `chore/m5-governance` | `chore(m5): PROGRESS.md M5 ✅, DECISIONS.md D07/D08, BACKLOG.md` |

---

## PR 0 — docs(m5): add consolidated M5 spec

Branch: `docs/m5-spec`

Move `m5-spec.md` and `m5-ralplan.md` from repo root to `docs/`.
No code changes in this PR.

**Filesystem authority note:** When implementing later PRs, translate every `.jsx`/`.js` path in this spec to the actual `.tsx`/`.ts` path in the repo. The filesystem is the source of truth, not the code samples. Spec samples are illustrative; grep the repo before editing.

**Consensus amendments applied in PR 0 (ralplan iter-2 APPROVE):**
- PR 1 gains **Fix 1d** (backend `requestId` generation, moved from PR 5 §5.2) and **Fix 1e** (D06 reconnect-pause amendment recorded in `docs/DECISIONS.md`).
- PR 2 **Fix 2c** amended: lifts SSE to AppContext AND relocates `sse-auth-error` to an AppContext-owned global banner; while active, EventSource pauses (opt-out of D06 permanent loop).
- PR 3 reuses the existing `theme-toggle` testid at `apps/web/src/components/ThemeToggle.tsx` — do not duplicate.
- PR 4 criterion "smooth 2s packet animation" downgraded to computed-style assertion (`animation-duration === '2000ms'`, mock-clock inter-event delta === 3000ms).
- PR 5 §5.2 becomes consumer-only (backend generation now in PR 1 Fix 1d).
- Pre-mortem scenario 6 added to `docs/m5-ralplan.md` covering `offset-path` browser-compat fallback.
- `docs/m5-ralplan.md` records operator **§12 auto-merge override** for M5 only.

---

## PR 1 — fix(m5): backend bug fixes

Branch: `fix/m5-backend-bugs`

### Fix 1a — Amount unit: define cents as the canonical unit

**Decision D07:** amounts are stored and transmitted as integers in cents.
- `5000` = $50.00, `3000` = $30.00, `9999` = $99.99

**Files to update:**
- `apps/ledger/src/application/usecases/createTransaction.js` — ensure no float truncation
- `apps/ledger/src/http/routes/transactions.js` — schema: `amount` must be a positive integer

**demoFlow amounts (apps/web/src/flows/demoFlow.js):**
```
CREDIT $50.00  → amount: 5000
DEBIT  $30.00  → amount: 3000
CREDIT $100.00 → amount: 10000
DEBIT  $999.99 → amount: 99999  (insufficient balance step)
```
Labels in demoFlow must match: `"Credit +$50.00"`, `"Debit -$30.00"`, etc.

### Fix 1b — Reset DB endpoint: add ?confirm=YES requirement

**File:** `apps/ledger/src/http/debug.js` and `apps/identity/src/http/debug.js`

The `DELETE /debug/reset` endpoint must require `?confirm=YES` query param.
Without it → 400 `{ error: "CONFIRM_REQUIRED", message: "Pass ?confirm=YES to confirm reset" }`.

**Frontend** `apps/web/src/api/debug.js` — update `resetDb()`:
```javascript
export async function resetDb(service) {
  const port = service === 'identity' ? 3002 : 3001;
  const res = await fetch(`http://localhost:${port}/debug/reset?confirm=YES`, {
    method: 'DELETE'
  });
  if (!res.ok) throw new Error(`Reset failed: ${res.status}`);
  return res.json();
}
```

### Fix 1c — Reset DB modal: wire confirm button to actual API call

**File:** `apps/web/src/components/DbInspector/DbInspector.jsx` (or equivalent)

The modal currently renders but the confirm button does not trigger `resetDb()`.
Wire `[Confirm Reset]` button to call `Promise.all([resetDb('identity'), resetDb('ledger')])`,
then close modal and trigger automatic Refresh.

### Fix 1d — Backend requestId on every SSE envelope (moved from PR 5 §5.2)

**Files:** `apps/ledger/src/http/*` instrumentation hooks and `apps/identity/src/http/*` instrumentation hooks that emit SSE events.

Every SSE event envelope emitted by either service must carry a `requestId: string` field — 6 lowercase hex characters, generated once per incoming HTTP request:

```javascript
import { randomBytes } from 'node:crypto';
const requestId = randomBytes(3).toString('hex'); // e.g. "a1b2c3"
```

Generate in the `onRequest` hook, attach to `request.requestId`, and include on every event emitted during that request (request, db start/end, response, error). Preserve D06 guarantees: per-user filter (`event.userId !== request.user.sub` skips) and `/events`/`/health` route exclusions remain intact.

PR 5 becomes consumer-only: Terminal reads `event.requestId` and renders the `[req-XXXXXX]` prefix — no backend work.

### Fix 1e — Record D06 reconnect-pause amendment in docs/DECISIONS.md

**File:** `docs/DECISIONS.md` (sensitive path — operator pre-approved in `docs/m5-ralplan.md` §"Operator approvals recorded").

Append a dated amendment to the D06 entry:

> **D06 Amendment (2026-04-15):** When `sse-auth-error` state is active in AppContext (PR 2 Fix 2c), both EventSource connections pause — they are closed and not reconnected — until the user refreshes the page. This is an intentional opt-out of D06's "permanent reconnect loop" behavior, required to prevent an app-wide reconnect storm once the SSE connection is lifted from `Observability` to global `AppContext` scope. The `sse-auth-error` banner is the user-visible signal.

### Criteria — PR 1

- [ ] `POST /transactions` with `amount: 5000` credits $50.00 to balance
- [ ] `GET /balance` returns `{ balance: 5000 }` (cents)
- [ ] Frontend displays $50.00 (divided by 100)
- [ ] `DELETE /debug/reset` without `?confirm=YES` returns 400
- [ ] `DELETE /debug/reset?confirm=YES` truncates tables and returns 200
- [ ] Reset DB modal confirm button calls both services and triggers Refresh
- [ ] Every SSE event on both services contains `requestId` matching `/^[0-9a-f]{6}$/`
- [ ] D06 amendment recorded in `docs/DECISIONS.md` (Fix 1e)
- [ ] **After PR 1 merge, before any subsequent E2E:** `curl -X DELETE 'http://localhost:3001/debug/reset?confirm=YES'` AND `curl -X DELETE 'http://localhost:3002/debug/reset?confirm=YES'` — D07 breaking change invalidates any pre-existing balance rows (pre-mortem scenario 5)
- [ ] `npm run typecheck && npm run lint && npm test` pass

---

## PR 2 — fix(m5): frontend bug fixes

Branch: `fix/m5-frontend-bugs`

### Fix 2a — Playground accordion: toggle on click

**File:** `apps/web/src/modes/Playground.jsx`

Currently clicking an open section header does not close it.

Fix: track `openSection` state (string | null). Clicking the active section sets it to null (closes). Clicking another section sets it to that section's id.

```javascript
const [openSection, setOpenSection] = useState(null);
const toggle = (id) => setOpenSection(prev => prev === id ? null : id);
```

Only one section open at a time — clicking one closes the previous.

### Fix 2b — Token pill: update when Playground POST /auth succeeds

**File:** `apps/web/src/api/identity.js` + `apps/web/src/contexts/AppContext.jsx`

When `POST /auth` succeeds in the Playground, call `setToken(data.access_token)` on the AppContext so the token pill at the top updates immediately.

The Playground's `handleSend` for the `/auth` endpoint must detect the response contains `access_token` and propagate it to context.

### Fix 2c — SSE reconnect on tab switch + global sse-auth-error banner

**Files:** `apps/web/src/contexts/AppContext.tsx`, `apps/web/src/modes/Observability.tsx`, plus whichever top-level layout component renders the global banner (e.g. `apps/web/src/App.tsx`).

The `EventSource` pair is being closed and reopened on every tab switch because `Observability` unmounts when you leave the tab. Fix (two parts):

**Part A — Lift the SSE connection to AppContext.** The connection persists across tab switches; `Observability` consumes the `events` array from context but does not own the connections.

```javascript
// In AppContext — open while token exists and not auth-errored
useEffect(() => {
  if (!token || sseAuthError) return;
  const sources = [
    new EventSource(`http://localhost:3001/events?token=${token}`),
    new EventSource(`http://localhost:3002/events?token=${token}`),
  ];
  // ... event handlers, cleanup, onerror sets sseAuthError
  return () => sources.forEach(s => s.close());
}, [token, sseAuthError]);
```

**Part B — Relocate `sse-auth-error` UI to an AppContext-owned global banner.** The auth-error state previously lived inside `Observability.tsx`. Now:
- AppContext exposes `sseAuthError: boolean` and `clearSseAuthError(): void`.
- A global banner component renders at app-root level (above mode tabs) when `sseAuthError === true`, carrying `data-testid="sse-auth-error"` (the M4 contract — preserved, not renamed).
- While `sseAuthError` is true, the `useEffect` above **does NOT reconnect** — both EventSources stay closed until the user refreshes. This is an intentional opt-out of D06's permanent reconnect loop, recorded as the D06 amendment via PR 1 Fix 1e.
- `Observability.tsx` removes its inline `sse-auth-error` rendering; the M4 testid is preserved by the new global banner.
- The banner message is identical or clearer than the previous inline message; a "Reload" action calls `window.location.reload()`.

**Pre-mortem scenario 3 (restated in `docs/m5-ralplan.md`):** the opt-out reconnect-pause prevents an app-wide request storm once SSE runs globally — trading D06's auto-reconnect for an explicit user-driven refresh on auth failure.

### Fix 2d — Currency: R$ → $ everywhere

**Files:** `apps/web/src/flows/demoFlow.js`, all components that render amount

Replace all `R$` references with USD formatting:
```javascript
const formatAmount = (cents) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);
```

Apply to: StepCard amount display, Playground response area, DB Inspector balance column, Graph block balance display.

### Fix 2e — Terminal latency: cap decimal places

**File:** `apps/web/src/components/TerminalView/LogLine.jsx`

```javascript
const formatDuration = (ms) => `${Math.round(ms * 10) / 10}ms`;
// 2.7000000000163913 → "2.7ms"
// 142.3 → "142.3ms"
// 1200 → "1200ms"
```

### Criteria — PR 2

- [ ] Playground: clicking open section closes it; clicking another opens it (only one open at a time)
- [ ] Playground: POST /auth success updates token pill immediately
- [ ] Observability SSE stays connected when switching to Autoplay and back
- [ ] All amount displays show `$` with 2 decimal places
- [ ] Terminal latency shows at most 1 decimal place
- [ ] `npm run typecheck && npm run lint && npm test` pass

---

## PR 3 — feat(web): header redesign

Branch: `feat/m5-header`

### Current problems

- Title "ledger-api" is small, low contrast, no visual hierarchy
- "identityledger" label is confusing — looks like a business name, not a status indicator
- Light/dark toggle is buried next to "identityledger", looks like part of business logic

### New header layout

```
┌─────────────────────────────────────────────────────────┐
│  ledger-api          ● identity  ● ledger          ☀/🌙 │
│  [Autoplay] [Guided] [Playground] [Observability]       │
└─────────────────────────────────────────────────────────┘
```

**Title:** `ledger-api` — `font-size: 20px`, `font-weight: 700`, `color: var(--text-primary)`. Single line with the service health indicators and dark mode toggle on the same row.

**Health indicators:** replace "identityledger ★" with two explicit pills:
```
● identity    ● ledger
```
- Dot color: green (`var(--success)`) when service responds to `/health`, gray when down
- Poll every 10s (existing behavior, just re-styled)
- Label: service name in `font-size: 11px`, `color: var(--text-muted)`

**Dark mode toggle:** move to top-right corner of header. Icon: ☀ (light) / 🌙 (dark). No label needed — icon is self-explanatory. `data-testid="theme-toggle"`.

> **Reuse note (consensus amendment):** The `theme-toggle` data-testid already exists at `apps/web/src/components/ThemeToggle.tsx`. Reuse the existing component and testid — **do not duplicate**. The M4 contract carries forward; PR 3 relocates and re-styles the existing component, it does not introduce a new one.

### Criteria — PR 3

- [ ] Title visible and clearly larger than other text
- [ ] Two health dots with labels "identity" and "ledger" visible in header
- [ ] Dark mode toggle in top-right corner of header
- [ ] Health dots update correctly (green/gray) based on `/health` polling
- [ ] `npm run typecheck && npm run lint && npm test` pass

---

## PR 4 — feat(web): Graph view overhaul

Branch: `feat/m5-graph-overhaul`

### 4.1 — Client node

Add a "Client" block at top-left of the Graph, representing the browser/demo frontend.

```
┌──────────┐         ┌──────────────┐         ┌──────────────┐
│  Client  │ ──────▶ │   Identity   │ ──────▶ │    Ledger    │
│ browser  │         │   port 3002  │         │   port 3001  │
└──────────┘         └──────────────┘         └──────────────┘
                            │                        │
                            ▼                        ▼
                     ┌──────────────┐         ┌──────────────┐
                     │  identity-db │         │   ledger-db  │
                     └──────────────┘         └──────────────┘
```

`data-testid="client-block"`

### 4.2 — Packet animation

Replace static arrows with animated packets traveling along the arrow path.

**Packet:** a small circle (8px diameter) that travels from source to destination along the arrow SVG path using `stroke-dashoffset` animation or `offsetDistance` on `motion-path`.

**Call packet (request):** color `var(--identity)` (blue) for identity calls, `var(--ledger)` (emerald) for ledger calls.
**Response packet:** color `var(--success)` (green) for 2xx, `var(--error)` (red) for 4xx/5xx. Travels the reverse path.

**Timing in LIVE mode:**
- Packet travel duration = `max(300, actualLatencyMs)` ms
- Response packet departs when the response event arrives
- Minimum 300ms ensures the packet is always visible

**CSS keyframe (in `index.css` only):**
```css
@keyframes packet-travel {
  from { offset-distance: 0%; }
  to   { offset-distance: 100%; }
}
.packet {
  animation: packet-travel var(--packet-duration, 400ms) linear forwards;
  offset-path: path('M ...');  /* set per arrow via inline CSS var */
}
```

### 4.3 — Block expand on packet arrival

When a packet arrives at a service block, the block expands for 2 seconds showing the relevant data, then collapses back.

**Service block expanded state:**
```
┌──────────────────────────────┐
│  Ledger          port 3001   │
│  ● active                    │
│  ─────────────────────────── │
│  POST /transactions          │
│  { type: "DEBIT",            │
│    amount: 3000 }            │  ← request body (truncated to 2 lines)
│  ─────────────────────────── │
│  200 OK · 42ms               │  ← response summary (on response event)
└──────────────────────────────┘
```

**DB block expanded state:**
```
┌──────────────────────────────┐
│  ledger-db                   │
│  ● active                    │
│  ─────────────────────────── │
│  SELECT FOR UPDATE           │
│  balance: $127.00            │  ← current balance in USD
│  +$30.00  CREDIT             │  ← delta: green + for credit
│  -$30.00  DEBIT              │     red - for debit
└──────────────────────────────┘
```

Delta formatting:
- CREDIT: `+$XX.XX` in `var(--success)` green
- DEBIT: `-$XX.XX` in `var(--error)` red

Block expansion is a CSS transition: `max-height: 60px` (collapsed) → `max-height: 200px` (expanded), `overflow: hidden`, `transition: max-height 300ms ease`.

Auto-collapse after 2000ms using `setTimeout`.

### 4.4 — Playback mode

**States:** `LIVE` | `REPLAY`

**LIVE badge:** green pill `● LIVE` in top-left of Graph container.
**REPLAY badge:** amber pill `▶ REPLAY` with speed selector `[slow] [medium] [fast]`.

**Replay speeds:**
| Speed | Delay between events | Packet travel duration |
|---|---|---|
| slow | 3000ms | 2000ms |
| medium | 500ms | 400ms |
| fast | 200ms | 150ms |

**Replay trigger:** when Autoplay completes all 13 steps, a button appears in the Observability header:
```
▶ Replay in Graph
```
Clicking it switches Observability to REPLAY mode and plays back the captured events from the last Autoplay run at the selected speed.

**Event capture:** AppContext stores the last run's events in `lastRunEvents: SseEvent[]`. Events are replaced on each new Autoplay run. Replay iterates over `lastRunEvents` with `setTimeout` chains at the configured delay.

**REPLAY controls:**
```
▶ Replay in Graph   [slow ▼]   [■ Stop]
```
Stop returns to LIVE mode.

### data-testid — PR 4

```
data-testid="client-block"
data-testid="live-badge"
data-testid="replay-badge"
data-testid="replay-trigger"
data-testid="replay-speed-select"
data-testid="replay-stop"
data-testid="block-body-ledger"      ← expanded body content
data-testid="block-body-identity"
data-testid="db-balance-ledger"      ← balance display in db block
data-testid="db-delta-ledger"        ← delta (+/-) display
```

### Criteria — PR 4

- [ ] Client block visible in Graph
- [ ] Packet travels from Client → Identity → Ledger visually during Autoplay
- [ ] Response packet travels back in reverse with correct color (green/red)
- [ ] Block expands on packet arrival showing body + response summary
- [ ] DB block shows balance and delta with correct +/- color
- [ ] Block collapses after 2s automatically
- [ ] LIVE badge visible in live mode
- [ ] After Autoplay: "▶ Replay in Graph" button appears
- [ ] Replay slow: `[data-testid="live-badge"]` absent, `[data-testid="replay-badge"]` present; computed `animation-duration` on `.packet` element === `2000ms`; inter-event `setTimeout` delta === `3000ms` asserted via jest fake timers (not wall-clock visuals)
- [ ] Replay medium: computed `animation-duration` === `400ms`; inter-event delta === `500ms`
- [ ] Replay fast: computed `animation-duration` === `150ms`; inter-event delta === `200ms`
- [ ] Stop replay returns to LIVE mode
- [ ] `npm run typecheck && npm run lint && npm test` pass

---

## PR 5 — feat(web): Terminal overhaul

Branch: `feat/m5-terminal-overhaul`

### 5.1 — Three states

**Pill (minimized):**
- Positioned: `position: absolute; bottom: 8px; left: 8px` relative to the Observability container
- Appearance: `background: var(--bg-card); border: 1px solid var(--border); border-radius: 12px; padding: 4px 12px`
- Content: `Terminal · N ●` where N is count of unread events since minimized
- Unread dot color: `var(--success)` green, pulses when new events arrive
- Click → transitions to Default state

**Default (200px):**
- Renders below the Graph inside the Observability container
- Height: `200px`, fixed
- Internal scroll on the log list
- Header bar: `Terminal` label left, `[— □ ×]` buttons right
  - `—` → minimizes to Pill
  - `□` → maximizes
  - `×` → same as `—` (cosmetic close, minimizes)
- Glow effect: when a new event arrives, border flashes `var(--success)` for 200ms
  ```css
  @keyframes terminal-glow {
    0%, 100% { border-color: var(--border); }
    50%       { border-color: var(--success); box-shadow: 0 0 8px var(--success); }
  }
  ```

**Maximized:**
- Fills all available height below the Graph
- Same header bar with `□` toggling back to Default

### 5.2 — Request ID prefix (consumer-only)

Each SSE event carries a `requestId` field — 6 hex chars (e.g. `a1b2c3`). **Backend generation is PR 1 Fix 1d** (moved out of PR 5 per consensus amendment); PR 5 is consumer-only and reads `event.requestId`.

Terminal line format:
```
[HH:mm:ss.SSS] [req-a1b2c3] POST /transactions
[HH:mm:ss.SSS] [req-a1b2c3] → SELECT FOR UPDATE balance_snapshots
[HH:mm:ss.SSS] [req-a1b2c3] ✓ 200 OK (42.3ms)
```

Same requestId color-coded consistently per request (cycle through 4 muted colors) so interleaved events from parallel requests are visually separable.

### Mobile behavior

On viewports `< 768px`:
- Graph compresses to show only service blocks (no db blocks, reduced padding)
- Terminal Default state height: `160px`
- Maximized: takes full viewport height (Graph scrolls above)

### data-testid — PR 5

```
data-testid="terminal-pill"
data-testid="terminal-pill-count"
data-testid="terminal-default"
data-testid="terminal-maximized"
data-testid="terminal-minimize"   ← — button
data-testid="terminal-maximize"   ← □ button
data-testid="terminal-close"      ← × button (same behavior as minimize)
```

### Criteria — PR 5

- [ ] Terminal starts in Pill state when Observability loads
- [ ] Clicking pill opens Default (200px)
- [ ] `—` and `×` both minimize to Pill
- [ ] `□` maximizes; clicking again restores Default
- [ ] Pill shows unread event count
- [ ] Border glows green for 200ms on new event in Default state
- [ ] Request ID prefix on every Terminal line
- [ ] Parallel requests show interleaved lines with consistent color per requestId
- [ ] Mobile: Graph compresses when Terminal opens
- [ ] `npm run typecheck && npm run lint && npm test` pass

---

## PR 6 — feat(web): Autoplay step delay + Observability co-visibility

Branch: `feat/m5-autoplay-delay`

### 6.1 — Step delay

Add a configurable delay between Autoplay steps so SSE events are visible in real time.

Default delay: **800ms** between steps.

The delay is applied after each step completes (after the API response is received), before starting the next step.

```javascript
// In Autoplay.jsx after each step
await new Promise(resolve => setTimeout(resolve, stepDelay));
```

`stepDelay` is a constant in `AppContext` or a local const in Autoplay — not exposed as user setting (too much UI for an internal demo).

### 6.2 — "▶ Replay in Graph" button on Autoplay completion

When Autoplay reaches step 13/13 and shows "Flow complete — all 13 steps passed", display a secondary button:

```
[Restart]   [▶ Replay in Graph]
```

Clicking "▶ Replay in Graph":
1. Switches to Observability tab
2. Activates REPLAY mode with `slow` speed as default
3. Starts playback of `lastRunEvents` from AppContext

### Criteria — PR 6

- [ ] Autoplay pauses ~800ms between steps (visible in UI progression)
- [ ] "▶ Replay in Graph" button appears on completion
- [ ] Clicking it navigates to Observability and starts replay in slow mode
- [ ] `npm run typecheck && npm run lint && npm test` pass

---

## PR 7 — test(web): Playwright E2E for M5

Branch: `test/m5-playwright`

### Prerequisites

```bash
docker compose up -d
npx wait-on http://localhost:3001/health http://localhost:3002/health
npx playwright install chromium --with-deps
```

### Required test cases

**Header**
- [ ] Title "ledger-api" visible with correct font-weight
- [ ] Two health dots visible with labels "identity" and "ledger"
- [ ] `[data-testid="theme-toggle"]` toggles class on document root

**Bugs fixed**
- [ ] Playground: clicking open section closes it
- [ ] Playground: POST /auth updates token pill
- [ ] SSE stays connected across Autoplay → Observability tab switch
- [ ] Amount displayed as `$50.00` not `R$5000`

**Graph — packets**
- [ ] `[data-testid="client-block"]` renders
- [ ] During Autoplay, `[data-testid="live-badge"]` is visible
- [ ] After Autoplay, `[data-testid="replay-trigger"]` appears
- [ ] Clicking replay-trigger shows `[data-testid="replay-badge"]`

**Terminal states**
- [ ] `[data-testid="terminal-pill"]` visible on Observability load
- [ ] Clicking pill shows `[data-testid="terminal-default"]`
- [ ] `[data-testid="terminal-minimize"]` returns to pill
- [ ] `[data-testid="terminal-maximize"]` shows maximized state

**Reset DB**
- [ ] After confirming reset, DB Inspector shows 0 rows

### Criteria — PR 7

- [ ] ≥ 20 tests passing across 3 browser projects
- [ ] Zero flakiness (3 consecutive runs all pass)
- [ ] `npm run typecheck && npm run lint && npm test` pass

---

## PR 8 — chore(m5): governance

Branch: `chore/m5-governance`

- `docs/PROGRESS.md`: mark M5 ✅, list PRs 0–8
- `docs/DECISIONS.md`: add D07 (cents as canonical unit), D08 (USD display)
- `docs/BACKLOG.md`: update with post-M5 refinements

---

## Global constraints — non-negotiable

- D03: `apps/web` does not import from `@ledger/*`, `apps/identity/*`, `apps/ledger/*`
- D04: no axios, no Redux, no animation library, no UI library
- CSS `@keyframes` and transitions in `index.css` only — not inline, not in component files
- `data-testid` values are a contract — never remove or rename between PRs
- `.devcontainer/` is a sensitive path — do not touch without explicit operator approval
- `apps/web/test-results/` and `apps/web/playwright-report/` never enter git
