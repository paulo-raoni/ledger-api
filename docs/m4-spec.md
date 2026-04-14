# M4 Spec — Observability Dashboard + M3 Bug Fixes

**Milestone:** M4
**Depends on:** M3 ✅
**Base branch:** main
**Author:** Paulo Raoni (generated via claude.ai, 2026-04-14)

---

## Read before writing any code

Read in this order:
1. `CLAUDE.md`
2. `docs/PROGRESS.md`
3. `docs/DECISIONS.md`
4. `docs/openapi/ms-identity.yaml` and `docs/openapi/ms-ledger.yaml`
5. This complete spec

---

## Architectural decisions — M4 adds D06

| ID | Decision |
|---|---|
| D01 | Knex for migrations, raw pg for queries |
| D02 | SELECT FOR UPDATE (pessimistic locking) on transactions table — balance_snapshots wiring deferred to backlog |
| D03 | apps/web standalone — no `@ledger/*` imports |
| D04 | Native fetch + React Context — no axios, no Redux, no animation lib, no UI lib |
| D05 | `/debug/db` and `/debug/reset` gated by `NODE_ENV !== 'production'` |
| D06 | SSE via native `EventSource` — no library, no polling, automatic browser reconnect. JWT passed as query param (`?token=`) — demo-only pattern, not suitable for production. Token rotation terminates the SSE stream; client must reconnect with a new token (no silent re-auth). EventSource auto-reconnect re-sends the same query param, so an expired token causes permanent disconnect until the user refreshes the page. |

<!-- revision 1: change #11 — D06 expanded with JWT/token-rotation warnings per change #24 -->

---

## Global constraints — non-negotiable

- D03: `apps/web` does not import from `@ledger/*`, `apps/identity/*`, or `apps/ledger/*`
- D04: no axios, no Redux, no animation library, no UI library (Tailwind utilities only)
- **TypeScript strict mode in `apps/web` only.** `apps/{ledger,identity}` remain JavaScript ESM with zod validation.
- CSS transitions and keyframes in `index.css` only — not inline, not in component files
- `data-testid` are a contract — never remove, never rename between PRs
- `apps/web/test-results/` and `apps/web/playwright-report/` never enter git
- `.devcontainer/` is a sensitive path — do not touch without explicit operator approval

<!-- revision 1: change #5 — replaced "TypeScript strict mode in all new files" with scoped rule -->

---

## PR 1 — fix(m3): POST /transactions schema, SQL query, demoFlow, error handling, email collision, gitignore, devcontainer, idempotencyHook

Branch: `fix/m3-bugs`

> **PR 0 collapsed into PR 1.** This PR starts by moving `m4-spec.md` and `m4-ralplan.md` from the repo root into `docs/`. Delete both files from the root as part of this same commit.

<!-- revision 1: change #2 — PR 0 collapsed into PR 1; docs move is the first commit in this PR -->

### Docs move (first commit)

Move `m4-spec.md` → `docs/m4-spec.md` and `m4-ralplan.md` → `docs/m4-ralplan.md`.
Delete originals from repo root. No code changes in this commit.

---

### Bug #1 — Schema: ledger rejects body without user_id

**Files:**
- `apps/ledger/src/http/routes.js` — Fastify route schema for POST /transactions
- `apps/ledger/src/application/usecases/createTransaction.js` — zod schema (line 6–10) and user_id enforcement (line 21)

**Problem:** The zod schema in `createTransaction.js` requires `user_id` (line 7) and enforces `data.user_id !== authUserId` (line 21). The spec defines only `{type, amount}` as required in the request body. `user_id` must be taken from the JWT (`request.user.sub`), which is already available as `authUserId`.

<!-- revision 1: change #7 — Bug #1 expanded to cover createTransaction.js zod schema, not just the route schema -->

**Fix — zod schema in `apps/ledger/src/application/usecases/createTransaction.js`:**

```js
// Before (lines 6–10):
const schema = z.object({
  user_id: z.string().min(1),
  type: z.enum(['CREDIT', 'DEBIT']),
  amount: z.number().int().positive(),
});

// After:
const schema = z.object({
  type: z.enum(['CREDIT', 'DEBIT']),
  amount: z.number().int().positive(),
});
```

**Fix — use-case body (same file):** Replace every `data.user_id` with `authUserId`. Remove the `data.user_id !== authUserId` guard (lines 20–22). Update `usersClient.assertUserExists(data.user_id)` → `usersClient.assertUserExists(authUserId)`. Update `repo.insertTransactionTx` call and `snapshotRepo.upsertTx` call to pass `authUserId` instead of `data.user_id`.

**Fix — Fastify route schema in `apps/ledger/src/http/routes.js`:** Remove `user_id` from the JSON schema body (if present as an explicit field):

```js
// Correct body schema (JSON Schema, not zod — matches existing Fastify convention):
body: {
  type: 'object',
  required: ['type', 'amount'],
  properties: {
    type: { type: 'string', enum: ['CREDIT', 'DEBIT'] },
    amount: { type: 'number', minimum: 0.01 },
    idempotencyKey: { type: 'string' }  // optional
  },
  additionalProperties: false
}
```

**Test files that require updates (~28 call-sites):**

The following test files pass `user_id` in the input body and will need updating:
- `apps/ledger/src/application/usecases/__tests__/createTransaction.test.js`
- `apps/ledger/src/application/usecases/__tests__/createTransaction.acid.test.js`
- `apps/ledger/src/application/usecases/__tests__/getBalance.snapshot.test.js`
- `apps/ledger/src/application/usecases/__tests__/idempotency.test.js`
- Any other test file in `apps/ledger/src/application/usecases/__tests__/` that passes `user_id` in the call to `execute()`

Sub-tasks for Bug #1:
- [ ] Remove `user_id` from zod schema in `createTransaction.js`
- [ ] Replace all `data.user_id` with `authUserId` in use-case body
- [ ] Remove `data.user_id !== authUserId` guard
- [ ] Update all test files to omit `user_id` from input body
- [ ] Verify `curl -X POST` without `user_id` returns 200

---

### Bug #2 — SQL: FOR UPDATE with aggregate function

**File:** `apps/ledger/src/infra/repositories/transactionsRepository.js` (lines 15–33)

**Problem:** `getBalanceByUserForUpdate` runs `SELECT COALESCE(SUM(amount) ...) FOR UPDATE` on the `transactions` table. PostgreSQL forbids `FOR UPDATE` with aggregate functions — this causes a runtime error on every DEBIT.

<!-- revision 1: change #8 — Bug #2 rescoped: fix stays on transactions table; balance_snapshots NOT used as lock row here -->

**Fix:** Use a Postgres **transaction-scoped advisory lock** keyed by the user id, then read the aggregate without `FOR UPDATE`. This is the minimal correct fix — it adds no new table semantics, touches no other repository, and is released automatically on COMMIT/ROLLBACK. Do NOT introduce `balance_snapshots` as a lock row in this PR (that table is currently wired via `snapshotRepo.upsertTx` for snapshot writes but is not the pessimistic lock row). Adopting `balance_snapshots` as the pessimistic lock mechanism is a D02 refinement deferred to backlog.

```js
// transactionsRepository.js — replace getBalanceByUserForUpdate with two methods

// 1. Acquire a tx-scoped advisory lock on a stable numeric key derived from userId.
//    hashtext(text) returns int4 (Postgres built-in). pg_advisory_xact_lock is
//    released automatically when the enclosing transaction commits or rolls back.
async lockUserForUpdate(client, userId) {
  await client.query(
    `SELECT pg_advisory_xact_lock(hashtext($1))`,
    [String(userId)]
  );
},

// 2. Read balance without FOR UPDATE (aggregate-safe)
async getBalanceByUser_tx(client, userId) {
  const { rows } = await client.query(
    `SELECT COALESCE(SUM(
       CASE
         WHEN type = 'CREDIT' THEN amount
         WHEN type = 'DEBIT' THEN -amount
         ELSE 0
       END
     ), 0) AS amount
     FROM transactions
     WHERE user_id = $1`,
    [userId]
  );
  return Number(rows[0]?.amount ?? 0);
},
```

Then in `createTransaction.js`, replace:
```js
const balance = await repo.getBalanceByUserForUpdate(client, authUserId);
```
with:
```js
await repo.lockUserForUpdate(client, authUserId);
const balance = await repo.getBalanceByUser_tx(client, authUserId);
```

**Why advisory lock (not `SELECT ... FOR UPDATE` on transactions):** the transactions table has no single sentinel row per user; `FOR UPDATE` on an empty or unstable result set does not block concurrent INSERTs. `pg_advisory_xact_lock(hashtext(user_id))` gives a single-row-equivalent mutex scoped to the current user, auto-released at transaction end, zero schema changes.

**Note:** `balance_snapshots` remains wired via `snapshotRepo.upsertTx` for snapshot writes — unchanged in this PR. Adopting `balance_snapshots.version` as the pessimistic/optimistic lock mechanism (D02 refinement) is a backlog item added in PR 8.

---

### Bug #3 — demoFlow includes user_id in body

**File:** `apps/web/src/flows/demoFlow.ts`

**Fix:** Remove `user_id` from all steps that call POST /transactions. Apply after Bug #1 is fixed.

Before:
```typescript
body: { type: 'CREDIT', amount: 5000, user_id: userId }
```
After:
```typescript
body: { type: 'CREDIT', amount: 5000 }
```

---

### Bug #4 — "Cannot reach service" for any status >= 400

**Files:** `apps/web/src/api/identity.ts`, `apps/web/src/api/ledger.ts`

**Fix:** Distinguish network errors (fetch throws) from HTTP error responses.

```typescript
// Correct pattern for all api methods
try {
  const res = await fetch(url, options);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(res.status, body.message ?? res.statusText, body.code);
  }
  return res.json();
} catch (err) {
  if (err instanceof ApiError) throw err;
  // Only here is it a genuine network error
  throw new NetworkError('Cannot reach service. Is docker-compose running?');
}
```

`ApiError` and `NetworkError` are distinct classes — StepCard and Playground render different messages for each.

---

### Bug #5 — Email collision when switching mode without Restart

**File:** `apps/web/src/contexts/AppContext.tsx`

**Verification:** `runEmail` state already exists in `AppContext` (confirmed at line 37 and 71).

**Fix:** Generate a new `runEmail` when mode changes.

```typescript
useEffect(() => {
  setRunEmail(`alice+${Date.now()}@demo.com`);
  setCurrentStep(0);
  setHistory([]);
}, [mode]);
```

---

### Bug #6 — `reply.addHook` in idempotencyHook.js:46 causes 500

**File:** `apps/ledger/src/http/hooks/idempotencyHook.js` (line 46)

<!-- revision 1: change #9 — new bug added -->

**Problem:** `reply.addHook('onSend', ...)` is called on the Fastify `reply` object. Fastify `reply` does not expose `addHook` — this method only exists on the `fastify` instance. Every request that includes an `Idempotency-Key` header currently results in a 500 because `reply.addHook` throws `TypeError: reply.addHook is not a function`.

**Fix:** Do NOT call `addHook` per request — Fastify `addHook` registers for the *lifetime of the server*, so calling it inside a request handler leaks a new closure on every request. Register the `onSend` hook **once, at plugin/route-file load time**, and have it read per-request state (`request.idempotencyKey`, `request.idempotencyUserId`, `request.idempotencySavedInTx`) that the idempotency preHandler already attaches.

Restructure `idempotencyHook.js` as a Fastify plugin (or call-once during route registration) that exposes two pieces:

```js
// apps/ledger/src/http/hooks/idempotencyHook.js

export async function registerIdempotency(fastify) {
  // preHandler: unchanged — parse header, short-circuit on cache hit,
  // attach { idempotencyKey, idempotencyUserId, idempotencySavedInTx } to request
  fastify.addHook('preHandler', async (request, reply) => {
    const key = request.headers['idempotency-key'];
    if (!key) return;
    request.idempotencyKey = key;
    request.idempotencyUserId = request.user?.sub;
    request.idempotencySavedInTx = false;
    // (existing cache-hit short-circuit logic stays here)
  });

  // onSend: registered ONCE. Fires for every response; bails fast when
  // the request did not carry an Idempotency-Key or when the use-case
  // already saved the key inside its transaction.
  fastify.addHook('onSend', async (request, reply, payload) => {
    if (!request.idempotencyKey) return payload;
    if (request.idempotencySavedInTx) return payload;

    let body;
    try {
      body = typeof payload === 'string' ? JSON.parse(payload) : payload;
    } catch {
      return payload;
    }
    try {
      await idempotencyRepo.saveWithCTE(
        request.idempotencyKey,
        request.idempotencyUserId,
        reply.statusCode,
        body
      );
    } catch (err) {
      request.log.error({ err }, 'idempotency: failed to save key');
    }
    return payload;
  });
}
```

Then wire it once in route registration (`apps/ledger/src/http/routes.js` or the ledger plugin bootstrap):

```js
import { registerIdempotency } from './hooks/idempotencyHook.js';
await registerIdempotency(fastify);
```

**Why not `request.server.addHook(...)` inside the handler:** every call to `fastify.addHook` appends a persistent callback to the server's hook chain. A per-request registration leaks one closure per request and is never garbage-collected. After N requests the onSend chain has N entries, each guarded by a `_req !== request` check — functionally correct but memory- and CPU-degrading. Register once, guard by `request.idempotencyKey`.

**Alternative (even simpler, if acceptable):** skip the onSend hook entirely and perform the idempotency save at the end of each handler that opts into it (`createTransaction` already saves inside its transaction via `idempotencyRepo.saveTx`; the onSend hook is only belt-and-suspenders for future non-transactional handlers). If no such handlers exist today, delete the hook and rely on in-transaction saves. Pick this path if code audit confirms no current caller depends on the onSend fallback.

---

### Fix A — .gitignore: split malformed concatenated entry

**File:** `.gitignore` (lines 46–48)

<!-- revision 1: change #10 — rewritten to explicitly call out the malformed concatenated path -->

**Problem:** Line 50 (current content) contains `.claude/apps/web/test-results/` as a single concatenated path — this is a bug. `.claude/` is an OMC state directory; `apps/web/test-results/` is Playwright output. They were accidentally joined into one path that matches neither correctly.

**Fix:** Split into three separate entries on separate lines. Replace the malformed block:

```
# Current (broken — one concatenated path):
.claude/apps/web/test-results/
apps/web/playwright-report/

# Replace with (three separate entries):
.claude/
apps/web/test-results/
apps/web/playwright-report/
```

If `apps/web/test-results/` files are already tracked, remove them from the index:
```bash
git rm -r --cached apps/web/test-results/
git rm -r --cached apps/web/playwright-report/
```
Commit the updated `.gitignore` in this PR.

---

### Fix B — .devcontainer/devcontainer.json: commit current working-copy verbatim

**File:** `.devcontainer/devcontainer.json`

<!-- revision 1: change #11 — picked one interpretation: commit verbatim, no edits -->

**Operator approval:** Committing `.devcontainer/devcontainer.json` is **explicitly approved** for this PR only — a one-time exception to the sensitive-path rule for `.devcontainer/`.

**Fix:** Commit the current working-copy content of `devcontainer.json` verbatim. It already contains `"openai.chatgpt"` in the extensions list. Do **not** edit the file — commit it exactly as-is.

---

### Done criteria — PR 1

- [ ] `curl -X POST http://localhost:3001/transactions -H "Authorization: Bearer <token>" -H "Content-Type: application/json" -d '{"type":"CREDIT","amount":5000}'` returns 200
- [ ] POST /transactions with Idempotency-Key works (201 on first, 200 idempotent on repeat) — no 500 from `reply.addHook`
- [ ] POST /transactions DEBIT with insufficient balance returns 422 INSUFFICIENT_BALANCE (not 500)
- [ ] Autoplay completes 13 steps without error
- [ ] DB Inspector — Ledger tab shows transactions after a complete run
- [ ] Switching Autoplay → Guided → Autoplay without Restart does not cause 409
- [ ] `apps/web/test-results/` and `apps/web/playwright-report/` do not appear in `git status`
- [ ] `.claude/` does not appear in `git status` (was being leaked by malformed .gitignore path)
- [ ] `.devcontainer/devcontainer.json` committed with `"openai.chatgpt"` in extensions list
- [ ] `m4-spec.md` and `m4-ralplan.md` moved to `docs/` — originals deleted from root
- [ ] `npm run typecheck && npm run lint && npm test` pass

---

## PR 2 — feat(sse): add GET /events SSE endpoint to both services

Branch: `feat/m4-sse-endpoints`

> **Requires explicit operator sign-off before auto-merge.** This PR introduces new public API surface across both services. CI green + Codex LGTM is necessary but not sufficient — operator must explicitly approve before merge.

<!-- revision 1: change #32 — human gate added for PR 2 -->

### Endpoint

```
GET /events?token=<jwt>
Content-Type: text/event-stream
Cache-Control: no-cache
Connection: keep-alive
```

EventSource does not support headers natively. Token is passed as a query param and validated in the backend. No token → 401.

### Event schema

Every emitted SSE event must include `timestamp` (epoch ms) as a required field:

<!-- revision 1: change #12 — timestamp required on every event -->
<!-- revision 1: change #16 — userId bound to request.user.sub -->

```js
// Request received
{ type: 'request', service: 'ledger'|'identity', method: String, path: String, userId: String, timestamp: Number }

// Idempotency check
{ type: 'idempotency_check', key: String, hit: Boolean, userId: String, timestamp: Number }

// DB operation — start
{ type: 'db', phase: 'start', operation: 'SELECT FOR UPDATE'|'INSERT'|'UPDATE'|'COMMIT'|'ROLLBACK', table: String, userId: String, timestamp: Number }

// DB operation — end
{ type: 'db', phase: 'end', operation: String, table: String, durationMs: Number, userId: String, timestamp: Number }

// Response sent
{ type: 'response', status: Number, durationMs: Number, userId: String, timestamp: Number }

// Error
{ type: 'error', status: Number, message: String, code?: String, userId: String, timestamp: Number }
```

`userId` is bound to `request.user.sub` (matching the `idempotencyHook.js` convention — not `req.user.id`).

### Implementation

**Pattern: internal EventEmitter per service.**

Each service maintains an `EventEmitter` in memory. The instrumentation middleware emits events to the emitter. The `/events` handler pipes events to the SSE response stream.

```js
// apps/ledger/src/events/eventBus.js
import { EventEmitter } from 'events';
export const eventBus = new EventEmitter();

// apps/ledger/src/http/events.js
import { eventBus } from '../events/eventBus.js';

export async function eventsRoute(fastify) {
  fastify.get('/events', { preHandler: [authenticate] }, async (request, reply) => {
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    });

    const send = (event) => {
      // Per-user filter: only forward events belonging to this user
      if (event.userId !== request.user.sub) return;
      reply.raw.write(`data: ${JSON.stringify(event)}\n\n`);
    };

    eventBus.on('event', send);

    // Single cleanup handler: remove listener AND clear keepalive
    const keepalive = setInterval(() => {
      reply.raw.write(': keepalive\n\n');
    }, 15000);

    request.raw.on('close', () => {
      eventBus.off('event', send);
      clearInterval(keepalive);
    });
  });
}
```

<!-- revision 1: change #14 — per-user filter added to send() -->
<!-- revision 1: change #15 — single close handler consolidates listener removal + interval clear -->

**Instrumentation:** Add `eventBus.emit('event', {...})` calls at critical points in the `createTransaction` use-case and in Fastify `onRequest`, `onResponse`, and `onError` lifecycle hooks.

**IMPORTANT — exclude `/events` and `/health` from instrumentation hooks:**

<!-- revision 1: change #13 — explicit exclusion of /events and /health from hooks -->

`onRequest`, `onResponse`, and `onError` hooks must skip routes that would cause feedback loops:

```js
fastify.addHook('onRequest', (request, reply, done) => {
  if (request.routerPath === '/events' || request.routerPath === '/health') {
    return done();
  }
  // emit 'request' event
  eventBus.emit('event', { type: 'request', ... });
  done();
});
```

Apply the same guard to `onResponse` and `onError`.

### Same pattern for identity service

The identity service emits: `request`, `response`, `error`. No `idempotency_check` or granular `db` events — `request`/`response` is sufficient for the Graph view to show the service as active.

### Done criteria — PR 2

- [ ] `curl -N "http://localhost:3001/events?token=<token>"` opens SSE stream
- [ ] When POST /transactions runs in another terminal, events appear in the stream
- [ ] `curl -N "http://localhost:3002/events?token=<token>"` works the same
- [ ] No token → 401
- [ ] **Per-user isolation:** two tokens (two users), two open streams — each stream sees only events for its own user
- [ ] **`/events` and `/health` requests do not produce events in the SSE stream** (no feedback loop)
- [ ] Stream closes and reopens without memory leak (verify via `eventBus.listenerCount('event')` returning to baseline after disconnect)
- [ ] Listener count returns to baseline after client disconnect
- [ ] `npm run typecheck && npm run lint && npm test` pass
- [ ] **Operator sign-off required before merge** (CI green + Codex LGTM are necessary but not sufficient)

<!-- revision 1: change #14 — per-user isolation criterion added -->
<!-- revision 1: change #13 — /events exclusion criterion added -->
<!-- revision 1: change #15 — listener count criterion added -->

---

## PR 3 — feat(web): implement Observability Terminal view

Branch: `feat/m4-terminal-view`

### File structure

```
apps/web/src/modes/Observability.tsx           # container — manages SSE + Graph/Terminal toggle
apps/web/src/components/TerminalView/
├── TerminalView.tsx                            # list of LogLines with auto-scroll
└── LogLine.tsx                                 # colored line by event type
```

### AppContext — additions

```typescript
// Add to AppContext state
observabilityView: 'graph' | 'terminal';       // persists toggle during session
setObservabilityView: (v: 'graph' | 'terminal') => void;
```

<!-- revision 1: change #17 — viewport-aware default -->

**Default — viewport-aware:**
- `< 768px`: default `'terminal'`
- `≥ 768px`: default `'graph'`
- User toggle persists during the session (not stored in localStorage).

Initialise with:
```typescript
const [observabilityView, setObservabilityView] = useState<'graph' | 'terminal'>(
  () => window.innerWidth < 768 ? 'terminal' : 'graph'
);
```

### Observability.tsx — SSE logic

```typescript
// SSE — single shared connection used by both Graph and Terminal
const [events, setEvents] = useState<SseEvent[]>([]);
const [sseStatus, setSseStatus] = useState<'connected' | 'disconnected' | 'auth-error'>('disconnected');

// Ref mirrors sseStatus so effect closures read the live value, not the
// value captured at effect-creation time. Do NOT read `sseStatus` directly
// inside onerror — it is captured by closure and will be stale.
const sseStatusRef = useRef<'connected' | 'disconnected' | 'auth-error'>('disconnected');
const setStatus = (next: 'connected' | 'disconnected' | 'auth-error') => {
  sseStatusRef.current = next;
  setSseStatus(next);
};

useEffect(() => {
  if (!token) return;

  // Two connections: one for ledger, one for identity
  const sources = [
    new EventSource(`http://localhost:3001/events?token=${token}`),
    new EventSource(`http://localhost:3002/events?token=${token}`),
  ];

  sources.forEach(src => {
    src.onopen = () => setStatus('connected');

    // Auth-failure UX: error before any successful open → auth-error.
    // Error after a prior open → disconnected (browser auto-reconnects).
    // Reads sseStatusRef.current, NOT sseStatus, to avoid stale closure.
    src.onerror = () => {
      if (sseStatusRef.current !== 'connected') {
        setStatus('auth-error');
      } else {
        setStatus('disconnected');
      }
    };

    src.onmessage = (e) => {
      const event: SseEvent = JSON.parse(e.data);
      setEvents(prev => prev.length >= 500
        ? [...prev.slice(1), { ...event, receivedAt: Date.now() }]
        : [...prev, { ...event, receivedAt: Date.now() }]
      );
    };
  });

  return () => sources.forEach(s => s.close());
}, [token]);
```

**Executor note:** the effect only depends on `[token]`. If we read `sseStatus` from React state inside `onerror`, the closure captures the `'disconnected'` value at effect-creation time; after `onopen` fires and state becomes `'connected'`, the stale closure still sees `'disconnected'` and will (incorrectly) flip the UI to `'auth-error'` on the next transient network blip. The `sseStatusRef` pattern above reads the live value. Alternative: use functional `setSseStatus(prev => prev === 'connected' ? 'disconnected' : 'auth-error')`.

<!-- revision 1: change #18 — auth-error state added; receivedAt stamped on client -->
<!-- revision 1: change #19 — receivedAt stamped when pushing to events array -->

**Note on EventSource auth:** EventSource does not support headers natively. Token is passed as query param (`?token=<jwt>`) and validated in the backend. Decision documented as D06 trade-off.

**Auth-failure UX:** On `onerror` with no prior `onopen` (i.e. `sseStatus !== 'connected'`), set status to `'auth-error'`. Render a visible "Authentication failed — please sign in again" message distinct from the "disconnected" (reconnecting) state. Use `data-testid="sse-auth-error"` on that element.

<!-- revision 1: change #18 — sse-auth-error testid -->

### TerminalView.tsx

```typescript
// Props
interface TerminalViewProps {
  events: SseEvent[];
}

// Behaviour
// - auto-scroll to the last element when paused === false
// - when paused, scroll stays where the user left it
// - "Pause scroll" / "Resume scroll" button
// - always dark background (independent of app light/dark mode)
```

Layout:
```
┌─────────────────────────────────────────────────────────┐
│  [● connected]                        [Pause scroll]    │  ← fixed header
├─────────────────────────────────────────────────────────┤
│  [12:34:01.123] POST /transactions userId=abc           │
│  [12:34:01.125] → SELECT FOR UPDATE balance_snapshots   │
│  [12:34:01.140] → lock acquired (15ms)                  │
│  [12:34:01.144] → COMMIT                                │
│  [12:34:01.145] ✓ 200 OK (22ms)                         │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### LogLine.tsx — color coding

| Event type | CSS variable |
|---|---|
| `request` | `--text-muted` (grey) |
| `db` phase start | `var(--identity)` (blue) — db operations |
| `db` phase end | `var(--identity)` with opacity 0.7 |
| `idempotency_check` hit=false | `var(--text-muted)` |
| `idempotency_check` hit=true | `var(--warning)` (amber) — cache hit is significant |
| `response` status 2xx | `var(--success)` (green) |
| `response` status 4xx | `var(--warning)` (amber) |
| `response` status 5xx | `var(--error)` (red) |
| `error` | `var(--error)` (red) |

Line format:
```
[HH:mm:ss.SSS] <icon> <text>
```

Icons:
- `→` for db operations
- `✓` for response 2xx
- `✗` for error
- `⚠` for warning/lock
- no icon for request/info

### data-testid — PR 3

```
data-testid="mode-observability"      ← tab in main navigation
data-testid="toggle-graph"
data-testid="toggle-terminal"
data-testid="terminal-view"
data-testid="terminal-line"           ← each LogLine (multiple)
data-testid="terminal-pause"
data-testid="sse-status"              ← text: "connected", "disconnected", or "auth-error"
data-testid="sse-auth-error"          ← visible when auth fails before first connect
```

<!-- revision 1: change #18 — sse-auth-error testid added -->

### Done criteria — PR 3

- [ ] "Observability" tab appears in navigation
- [ ] SSE status indicator shows "connected" when services are up
- [ ] On running Autoplay, lines appear in the terminal in real time
- [ ] Auto-scroll works; Pause scroll freezes; Resume resumes
- [ ] Maximum 500 lines (FIFO — old lines disappear)
- [ ] Color coding correct by event type
- [ ] **Default view is `'terminal'` on viewports `< 768px` and `'graph'` on `≥ 768px`**
- [ ] On `onerror` before first connect, `data-testid="sse-auth-error"` is visible with message distinct from "disconnected"
- [ ] `npm run typecheck && npm run lint && npm test` pass

---

## PR 4 — feat(web): implement Observability Graph view

Branch: `feat/m4-graph-view`

### File structure

```
apps/web/src/components/GraphView/
├── GraphView.tsx          # container — positions blocks and arrows
├── ServiceBlock.tsx       # service block with state
├── DbBlock.tsx            # DB block (idle/active/error only)
└── Arrow.tsx              # CSS-animated arrow between blocks
```

### Layout — desktop (≥ 768px)

```
┌──────────────────┐         ┌──────────────────┐
│    identity      │  ─────▶ │     ledger       │
│    port 3002     │         │    port 3001     │
│   ● idle         │         │   ● idle         │
└──────────────────┘         └──────────────────┘
        │                           │
        ▼                           ▼
┌──────────────────┐         ┌──────────────────┐
│  identity-db     │         │   ledger-db      │
│   ● idle         │         │   ● idle         │
└──────────────────┘         └──────────────────┘
```

**CSS Grid layout:**
```css
.graph-container {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  grid-template-rows: auto auto auto;
  gap: 24px;
  align-items: center;
}
```

### ServiceBlock.tsx — states

```typescript
type ServiceState = 'idle' | 'active' | 'waiting' | 'error';

interface ServiceBlockProps {
  service: 'identity' | 'ledger';
  port: number;
  state: ServiceState;
}
```

**Styles by state:**

| State | Border | Dot color | Label | Animation |
|---|---|---|---|---|
| `idle` | `1px solid var(--border)` | `#94a3b8` | — | none |
| `active` | `1px solid var(--success)` | `#22c55e` | "active" | pulse CSS |
| `waiting` | `1px solid var(--warning)` | `#f59e0b` | "waiting" | none |
| `error` | `1px solid var(--error)` | `#ef4444` | "error" | none |

**Pulse animation (pure CSS — in `index.css`):**
```css
@keyframes pulse-dot {
  0%, 100% { opacity: 1; transform: scale(1); }
  50%       { opacity: 0.5; transform: scale(1.3); }
}
.dot-active {
  animation: pulse-dot 1s ease-in-out infinite;
}
```

### State logic — derived from SSE events

<!-- revision 1: change #19 — decay uses receivedAt (client arrival time), not event.timestamp -->
<!-- revision 1: change #20 — cross-user isolation: defensive filter on events -->

```typescript
// In Observability.tsx — state derived from received events
function deriveServiceState(service: 'identity' | 'ledger', events: SseEvent[]): ServiceState {
  // Defensive filter: ignore events not belonging to the current user
  // (already filtered at the bus level in PR 2, but belt-and-suspenders)
  const relevant = events.filter(e => e.service === service && e.userId === currentUserId);
  const recent = relevant.slice(-1)[0];

  if (!recent) return 'idle';

  // Use receivedAt (client-side arrival timestamp) for decay, NOT event.timestamp.
  // This ensures state returns to idle 2s after the last event even if the backend
  // clock differs from the client clock by > 500ms.
  const age = Date.now() - recent.receivedAt;
  if (age > 2000) return 'idle';  // stale event → idle

  if (recent.type === 'error') return 'error';
  if (recent.type === 'db' && recent.operation === 'SELECT FOR UPDATE') return 'waiting';
  if (recent.type === 'request' || recent.type === 'db') return 'active';
  if (recent.type === 'response') return 'idle';  // request completed → idle

  return 'idle';
}
```

The `receivedAt` field is stamped by the client when pushing events to the array (set in Observability.tsx `onmessage` handler, PR 3). The backend `timestamp` field is preserved for terminal rendering.

**Cross-user isolation:** `deriveServiceState` only considers events where `e.userId === currentUserId`. Events from other users are already filtered at the bus level in PR 2 but this defensive client-side filter is trivial and worth keeping.

### Arrow.tsx — animated arrows

Horizontal arrows (identity → ledger) and vertical arrows (service → db).

```typescript
interface ArrowProps {
  direction: 'right' | 'down';
  active: boolean;  // when active, animate
  color?: string;   // default: var(--text-muted)
}
```

**CSS for animated arrow:**
```css
@keyframes arrow-flow {
  0%   { stroke-dashoffset: 20; }
  100% { stroke-dashoffset: 0; }
}
.arrow-active line, .arrow-active path {
  stroke-dasharray: 5;
  animation: arrow-flow 0.5s linear infinite;
}
```

Arrow implemented as inline SVG (no library).

### Simultaneous requests

When two requests are in-flight simultaneously (e.g. Playground with two DEBITs via Promise.all):
- Each arrow receives a different color (cycling by request index)
- 4-color palette: `--identity`, `--ledger`, `--success`, `--warning`
- ServiceBlock shows `active` if any request is in-flight

### data-testid — PR 4

```
data-testid="graph-view"
data-testid="service-block-identity"
data-testid="service-block-ledger"
data-testid="db-block-identity"
data-testid="db-block-ledger"
data-testid="service-state-identity"    ← value: idle|active|waiting|error
data-testid="service-state-ledger"
```

### Responsiveness

- `≥ 768px`: Graph view is the default
- `< 768px`: Graph view still renders but with vertical layout (single column); the Graph/Terminal toggle already exists for mobile users who prefer Terminal

### Done criteria — PR 4

- [ ] Graph view renders the 4 blocks in the correct layout
- [ ] State changes to `active` (with pulse) on receiving `request` event
- [ ] State changes to `waiting` on receiving `db` event with `SELECT FOR UPDATE`
- [ ] State changes to `error` on receiving `error` event
- [ ] State returns to `idle` 2s after the last event for the service
- [ ] **Decay uses `receivedAt` (client arrival time) — state returns to `idle` 2s after last event even if backend clock differs by > 500ms** (test by injecting a past-dated event with `timestamp` set 10s in the past)
- [ ] Arrow between identity and ledger animates during requests
- [ ] Graph/Terminal toggle works without closing/reopening SSE
- [ ] **Events from other users are ignored** (defensive `userId` filter in `deriveServiceState`)
- [ ] `npm run typecheck && npm run lint && npm test` pass

---

## PR 5 — fix(web): CSS polish — padding, typography, colors, separators

Branch: `feat/m4-polish`

<!-- revision 1: change #3 — branch renamed from feat/m3-polish to feat/m4-polish -->

**Scope:** Pure CSS — zero logic changes, zero component structure changes.

### Required fixes

**1. Padding**
- Step card: `padding: 16px`
- Step header (service badge + method + path + status + latency): `gap: 8px`, `align-items: center`
- Playground form fields: `padding: 8px`

**2. Typography hierarchy**
```css
.step-title       { font-size: 18px; font-weight: 600; }
.badge-service    { font-size: 12px; font-family: monospace; }
.badge-method     { font-size: 12px; font-family: monospace; }
.badge-path       { font-size: 12px; font-family: monospace; }
.badge-status     { font-size: 12px; }
.json-body        { font-size: 13px; font-family: 'JetBrains Mono', monospace; }
.latency          { font-size: 11px; color: var(--text-muted); }
```

**3. Progress bar**
```css
.progress-bar     { height: 4px; border-radius: 2px; }
```

**4. Mode tabs**
```css
.mode-tab         { padding: 6px 16px; border-radius: 6px; }
.mode-tab.active  { background: var(--bg-card); font-weight: 600; }
```

**5. Border-radius**
```css
.card             { border-radius: 6px; }
.badge            { border-radius: 4px; }
button:not(.mode-tab) { border-radius: 4px; }
```

**6. REQUEST / RESPONSE separator**
```css
.response-section {
  border-top: 1px solid var(--border);
  padding-top: 12px;
  margin-top: 12px;
}
.section-label {
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--text-muted);
  margin-bottom: 4px;
}
```

**7. Palette colors**
- Service badges: `background: color-mix(in srgb, var(--identity) 15%, transparent)` for identity, same for ledger
- Status 200: `color: var(--success)`
- Status 4xx: `color: var(--warning)`
- Status 5xx: `color: var(--error)`
- Idempotency-Key header: `border-left: 2px solid var(--identity)` + `padding-left: 8px`

**8. Playground — Send / Response separation**
```css
.playground-response {
  border-top: 1px solid var(--border);
  padding-top: 12px;
  background: var(--bg-card-hover);
  border-radius: 0 0 6px 6px;
}
```

**9. Light mode — text-muted contrast**
```css
:root {
  --text-muted: #64748b;  /* contrast 4.7:1 — WCAG AA ✓ */
}
/* dark mode retains current value */
```

### Done criteria — PR 5

- [ ] Step card has visible padding — content does not touch edges
- [ ] Step title is clearly larger/bolder than the rest
- [ ] Progress bar visible (height ≥ 4px)
- [ ] Mode tabs with adequate padding and active tab highlighted
- [ ] Cards and badges with border-radius
- [ ] Visual separator between REQUEST and RESPONSE with labels
- [ ] Service badges colored by service
- [ ] Status codes colored correctly
- [ ] Playground: response area separated from form
- [ ] text-muted contrast in light mode ≥ 4.5:1

---

## PR 6 — feat(debug): DELETE /debug/reset + Reset DB button in DB Inspector

Branch: `feat/m4-reset-db`

<!-- revision 1: change #3 — branch renamed from feat/m3-reset-db to feat/m4-reset-db -->

### Backend — both services

```
DELETE /debug/reset?confirm=YES
Gate: NODE_ENV !== 'production' (same as /debug/db — D05)
Auth: no auth (same as /debug/db)
```

<!-- revision 1: change #21 — ?confirm=YES safety rail added -->

**Safety rail:** The endpoint requires `?confirm=YES` as a query parameter in addition to the `NODE_ENV` gate. Missing or incorrect value → 400 with `{ error: 'BAD_REQUEST', message: 'Pass ?confirm=YES to confirm reset' }`.

**identity service:**
```sql
TRUNCATE users CASCADE;
```
Returns: `{ truncated: ['users'] }`

**ledger service:**
```sql
TRUNCATE transactions, balance_snapshots, idempotency_keys CASCADE;
```
Returns: `{ truncated: ['transactions', 'balance_snapshots', 'idempotency_keys'] }`

Backend implementation (JavaScript ESM — both services):

```js
// Example for ledger service — identity follows same pattern
fastify.delete('/debug/reset', async (request, reply) => {
  if (process.env.NODE_ENV === 'production') {
    return reply.status(404).send({ error: 'NOT_FOUND' });
  }
  if (request.query.confirm !== 'YES') {
    return reply.status(400).send({
      error: 'BAD_REQUEST',
      message: 'Pass ?confirm=YES to confirm reset',
    });
  }
  await pool.query('TRUNCATE transactions, balance_snapshots, idempotency_keys CASCADE');
  return reply.send({ truncated: ['transactions', 'balance_snapshots', 'idempotency_keys'] });
});
```

### Frontend — DB Inspector

Button "⚠ Reset DB" next to the "Refresh" button in the DB Inspector header.

On click → confirmation modal:

```
┌───────────────────────────────────────────────────────┐
│  ⚠ Reset Database                                     │
│                                                       │
│  This will run:                                       │
│                                                       │
│  TRUNCATE users CASCADE;              (identity DB)   │
│  TRUNCATE transactions,                               │
│           balance_snapshots,                          │
│           idempotency_keys CASCADE;   (ledger DB)     │
│                                                       │
│  This cannot be undone.                               │
│                                                       │
│          [Cancel]          [Confirm Reset]            │
└───────────────────────────────────────────────────────┘
```

On confirm:
1. Call `DELETE http://localhost:3002/debug/reset?confirm=YES` (identity)
2. Call `DELETE http://localhost:3001/debug/reset?confirm=YES` (ledger)
3. Both in parallel (`Promise.all`)
4. On resolve → close modal → trigger automatic DB Inspector refresh
5. Show toast/feedback for success or error

**File:** `apps/web/src/api/debug.ts` — add `resetDb()`:
```typescript
export async function resetDb(service: 'identity' | 'ledger') {
  const port = service === 'identity' ? 3002 : 3001;
  const res = await fetch(`http://localhost:${port}/debug/reset?confirm=YES`, { method: 'DELETE' });
  if (!res.ok) throw new Error(`Reset failed: ${res.status}`);
  return res.json();
}
```

### data-testid

```
data-testid="reset-db-button"
data-testid="reset-db-modal"
data-testid="reset-db-confirm"
data-testid="reset-db-cancel"
```

### Done criteria — PR 6

- [ ] `DELETE http://localhost:3001/debug/reset?confirm=YES` truncates ledger tables and returns 200
- [ ] `DELETE http://localhost:3002/debug/reset?confirm=YES` truncates identity tables and returns 200
- [ ] `DELETE .../debug/reset` (without `?confirm=YES`) returns 400
- [ ] `DELETE .../debug/reset?confirm=WRONG` returns 400
- [ ] In production (`NODE_ENV=production`), endpoint returns 404 regardless of query param
- [ ] Button appears in DB Inspector
- [ ] Modal displays the exact SQL commands
- [ ] After confirming, DB Inspector shows empty states
- [ ] `npm run typecheck && npm run lint && npm test` pass

---

## PR 7 — test(web): Playwright E2E for Observability mode

Branch: `test/m4-playwright`

### Prerequisites

```bash
docker compose up -d
npx wait-on http://localhost:3001/health http://localhost:3002/health
```

Playwright binaries: `npx playwright install chromium --with-deps`

### Required test cases

**Tab navigation**
- [ ] Clicking `[data-testid="mode-observability"]` → Observability mode loads
- [ ] `[data-testid="sse-status"]` shows "connected" (with services up)
- [ ] `[data-testid="toggle-terminal"]` active by default on mobile viewport (`< 768px`)
- [ ] `[data-testid="toggle-graph"]` active by default on desktop viewport (`≥ 768px`)

<!-- revision 1: change #17 — toggle defaults updated to match viewport-aware logic -->

**Terminal view**
- [ ] After navigating to Autoplay and executing step 1, lines appear in `[data-testid="terminal-line"]` — use `page.waitForFunction` with generous timeout, not `waitForSelector`
- [ ] Pause scroll: clicking `[data-testid="terminal-pause"]` → new events do not cause scroll
- [ ] 500+ lines: confirm only 500 are kept in the DOM

**Graph view**
- [ ] `[data-testid="service-block-identity"]` and `[data-testid="service-block-ledger"]` render
- [ ] `[data-testid="service-state-identity"]` has value `idle` when no active request
- [ ] `[data-testid="db-block-identity"]` and `[data-testid="db-block-ledger"]` render
- [ ] During a request, `service-state-ledger` changes to `active` or `waiting` — use `page.waitForFunction` with generous timeout

<!-- revision 1: change #22 — waitForFunction required for SSE assertions -->

**Reset DB (PR 6)**
- [ ] `[data-testid="reset-db-button"]` is clickable
- [ ] Modal `[data-testid="reset-db-modal"]` appears
- [ ] Cancel closes modal without resetting
- [ ] Confirm: DB Inspector shows 0 rows in all tables

**Auth error**
- [ ] With an invalid token, `[data-testid="sse-auth-error"]` is visible

### Done criteria — PR 7

- [ ] New suite with ≥ 15 passing tests
- [ ] Tests run on all 3 existing projects (desktop-chromium, mobile-chrome, mobile-safari)
- [ ] **3 consecutive CI-style runs pass** (replaces "zero flakiness" — this is the verifiable gate)
- [ ] All SSE state assertions use `page.waitForFunction`, not `waitForSelector`
- [ ] `npm run typecheck && npm run lint && npm test` pass (includes Playwright)

<!-- revision 1: change #23 — flakiness gate replaced with "3 consecutive CI-style runs pass" -->

---

## PR 8 — chore(m4): governance

Branch: `chore/m4-governance`

**Sensitive-path edits in this PR are explicitly approved by the operator (recorded in `m4-ralplan.md`):**
- `docs/PROGRESS.md`
- `docs/DECISIONS.md`
- `docs/BACKLOG.md`

Changes:
- `docs/PROGRESS.md`: mark M4 ✅, list PRs 1–8
- `docs/DECISIONS.md`: add D06 (SSE via EventSource + query param auth trade-off, with the following content — see below)
- `docs/BACKLOG.md`: add post-M4 refinement item (see below)
- `CLAUDE.md`: verify if any section needs updating (sensitive paths, etc.)

<!-- revision 1: change #24 — D06 text documented with JWT/token-rotation warnings -->
<!-- revision 1: change #25 — BACKLOG item added -->

**D06 text for `docs/DECISIONS.md`:**

> **D06 — SSE via native EventSource + query-param JWT auth**
>
> EventSource does not support custom headers. JWT is passed as `?token=<jwt>` in the URL. This is a demo-only pattern and is **not appropriate for production** (token visible in access logs, browser history, and server-side request logs).
>
> Token rotation terminates the SSE stream. The client does not attempt silent re-authentication — reconnection requires an explicit user action (page refresh or re-login). EventSource automatic reconnect re-sends the same query param, so an expired or rotated token causes permanent disconnect until the user refreshes.
>
> Production alternatives: cookie-based auth (HttpOnly, SameSite=Strict) or a short-lived SSE ticket exchanged via a standard authenticated endpoint.

**Item for `docs/BACKLOG.md`:**

> **M4 refinement — wire balance_snapshots as pessimistic lock row for DEBIT path (D02 extension)**
>
> `balance_snapshots` exists (created in migration `20260413000002_create_balance_snapshots.cjs`) and is currently used for snapshot writes via `snapshotRepo.upsertTx`. It is not yet used as the primary lock row for the DEBIT concurrency path (D02). Wiring it as the lock row would make the SELECT FOR UPDATE target a single sentinel row rather than the entire transactions table, eliminating table-level contention under concurrent DEBITs.

---

## PR sequence summary

| PR | Branch | Title |
|---|---|---|
| 1 | `fix/m3-bugs` | `fix(m3): POST /transactions schema, SQL query, demoFlow, error handling, email collision, gitignore, devcontainer, idempotencyHook` |
| 2 | `feat/m4-sse-endpoints` | `feat(sse): add GET /events SSE endpoint to both services` |
| 3 | `feat/m4-terminal-view` | `feat(web): implement Observability Terminal view` |
| 4 | `feat/m4-graph-view` | `feat(web): implement Observability Graph view` |
| 5 | `feat/m4-polish` | `fix(web): CSS polish — padding, typography, colors, separators` |
| 6 | `feat/m4-reset-db` | `feat(debug): add DELETE /debug/reset + Reset DB button in DB Inspector` |
| 7 | `test/m4-playwright` | `test(web): add Playwright E2E for Observability mode` |
| 8 | `chore/m4-governance` | `chore(m4): PROGRESS.md M4 ✅, DECISIONS.md D06, BACKLOG.md` |

PR 5 and PR 6 do not depend on each other — they may be opened in parallel after PR 1, but merged sequentially.
