/**
 * Smoke tests — end-to-end validation of the full stack.
 *
 * Assumes docker-compose is already running.
 * Run with: npm run test:smoke
 *
 * Exit 0 on success, exit 1 on any failure.
 */

const IDENTITY_PORT = process.env.IDENTITY_PORT ?? '3002';
const LEDGER_PORT = process.env.LEDGER_PORT ?? '3001';

const IDENTITY_BASE = `http://localhost:${IDENTITY_PORT}`;
const LEDGER_BASE = `http://localhost:${LEDGER_PORT}`;

let passed = 0;
let failed = 0;

async function request(method, url, opts = {}) {
  const start = Date.now();
  const res = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(opts.headers ?? {}),
    },
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
  const duration = Date.now() - start;
  const path = new URL(url).pathname;
  console.log(`${method} ${path} → ${res.status} (${duration}ms)`);
  return res;
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

async function runTests() {
  let userId;
  let userEmail;
  let token;
  const idempotencyKey = `smoke-${Date.now()}`;

  // 1. POST /users — create user
  try {
    userEmail = `smoke-${Date.now()}@example.com`;
    const res = await request('POST', `${IDENTITY_BASE}/users`, {
      body: {
        first_name: 'Smoke',
        last_name: 'User',
        email: userEmail,
        password: 'SmokePass123!',
      },
    });
    assert(res.status === 200, `expected 200, got ${res.status}`);
    const body = await res.json();
    userId = body.id;
    assert(userId, 'userId missing from response');
    passed++;
    console.log('  PASS: create user');
  } catch (err) {
    failed++;
    console.error(`  FAIL: create user — ${err.message}`);
  }

  // 2. POST /auth — login with the same email from step 1
  try {
    const authRes = await request('POST', `${IDENTITY_BASE}/auth`, {
      body: { email: userEmail, password: 'SmokePass123!' },
    });
    assert(authRes.status === 200, `expected 200, got ${authRes.status}`);
    const authBody = await authRes.json();
    token = authBody.access_token;
    assert(token, 'access_token missing from auth response');
    assert(authBody.user?.id === userId, `user id mismatch: expected ${userId}, got ${authBody.user?.id}`);
    passed++;
    console.log('  PASS: login');
  } catch (err) {
    failed++;
    console.error(`  FAIL: login — ${err.message}`);
  }

  if (!token || !userId) {
    console.error('Cannot continue — missing token or userId after auth step');
    process.exit(1);
  }

  const authHeader = { Authorization: `Bearer ${token}` };

  // 3. POST /transactions — CREDIT 100 with Idempotency-Key
  let creditTxId;
  try {
    const res = await request('POST', `${LEDGER_BASE}/transactions`, {
      headers: { ...authHeader, 'Idempotency-Key': idempotencyKey },
      body: { user_id: userId, type: 'CREDIT', amount: 100 },
    });
    assert(res.status === 200, `expected 200, got ${res.status}`);
    const body = await res.json();
    creditTxId = body.id;
    assert(creditTxId, 'transaction id missing from response');
    assert(body.type === 'CREDIT', `expected type CREDIT, got ${body.type}`);
    assert(Number(body.amount) === 100, `expected amount 100, got ${body.amount}`);
    passed++;
    console.log('  PASS: CREDIT 100 transaction');
  } catch (err) {
    failed++;
    console.error(`  FAIL: CREDIT transaction — ${err.message}`);
  }

  // 4. POST /transactions — same Idempotency-Key (should return cached response)
  try {
    const res = await request('POST', `${LEDGER_BASE}/transactions`, {
      headers: { ...authHeader, 'Idempotency-Key': idempotencyKey },
      body: { user_id: userId, type: 'CREDIT', amount: 100 },
    });
    assert(res.status === 200, `expected 200 (cached), got ${res.status}`);
    const body = await res.json();
    assert(body.id === creditTxId, `expected same tx id ${creditTxId}, got ${body.id}`);
    passed++;
    console.log('  PASS: idempotent replay returns cached response');
  } catch (err) {
    failed++;
    console.error(`  FAIL: idempotency replay — ${err.message}`);
  }

  // 5. GET /balance — should be 100
  try {
    const res = await request('GET', `${LEDGER_BASE}/balance`, { headers: authHeader });
    assert(res.status === 200, `expected 200, got ${res.status}`);
    const body = await res.json();
    assert(Number(body.amount) === 100, `expected balance 100, got ${body.amount}`);
    passed++;
    console.log('  PASS: balance is 100 after CREDIT');
  } catch (err) {
    failed++;
    console.error(`  FAIL: balance check (100) — ${err.message}`);
  }

  // 6. POST /transactions — DEBIT 100
  try {
    const res = await request('POST', `${LEDGER_BASE}/transactions`, {
      headers: authHeader,
      body: { user_id: userId, type: 'DEBIT', amount: 100 },
    });
    assert(res.status === 200, `expected 200, got ${res.status}`);
    const body = await res.json();
    assert(body.type === 'DEBIT', `expected type DEBIT, got ${body.type}`);
    assert(Number(body.amount) === 100, `expected amount 100, got ${body.amount}`);
    passed++;
    console.log('  PASS: DEBIT 100 transaction');
  } catch (err) {
    failed++;
    console.error(`  FAIL: DEBIT transaction — ${err.message}`);
  }

  // 7. GET /balance — should be 0
  try {
    const res = await request('GET', `${LEDGER_BASE}/balance`, { headers: authHeader });
    assert(res.status === 200, `expected 200, got ${res.status}`);
    const body = await res.json();
    assert(Number(body.amount) === 0, `expected balance 0, got ${body.amount}`);
    passed++;
    console.log('  PASS: balance is 0 after DEBIT');
  } catch (err) {
    failed++;
    console.error(`  FAIL: balance check (0) — ${err.message}`);
  }

  // 8. GET /transactions — should return array with at least 2 items
  try {
    const res = await request('GET', `${LEDGER_BASE}/transactions`, { headers: authHeader });
    assert(res.status === 200, `expected 200, got ${res.status}`);
    const body = await res.json();
    assert(Array.isArray(body), 'expected array response');
    assert(body.length >= 2, `expected at least 2 transactions, got ${body.length}`);
    passed++;
    console.log('  PASS: list transactions returns >= 2 items');
  } catch (err) {
    failed++;
    console.error(`  FAIL: list transactions — ${err.message}`);
  }

  // 9. DELETE /users/:id — cleanup
  try {
    const res = await request('DELETE', `${IDENTITY_BASE}/users/${userId}`, {
      headers: authHeader,
    });
    assert(res.status === 200, `expected 200, got ${res.status}`);
    const body = await res.json();
    assert(body.ok === true, `expected ok: true, got ${JSON.stringify(body)}`);
    passed++;
    console.log('  PASS: delete user');
  } catch (err) {
    failed++;
    console.error(`  FAIL: delete user — ${err.message}`);
  }

  console.log(`\nResults: ${passed} passed, ${failed} failed`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Unhandled error:', err);
  process.exit(1);
});
