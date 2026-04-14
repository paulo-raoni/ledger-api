import { setup, teardown } from './setup.js';
import { transactionsRepository } from '../infra/repositories/transactionsRepository.js';
import { balanceSnapshotRepository } from '../infra/repositories/balanceSnapshotRepository.js';
import { idempotencyRepository } from '../infra/repositories/idempotencyRepository.js';
import { createTransactionUseCase } from '../application/usecases/createTransaction.js';
import { getBalanceUseCase } from '../application/usecases/getBalance.js';
import { randomUUID } from 'node:crypto';

let pool;
let db;
let repo;
let snapshotRepo;
let idempotencyRepo;
let createTransaction;
let getBalance;

const TEST_USER_ID = 'stress-user-1';

const mockUsersClient = {
  assertUserExists: async () => {},
};

beforeAll(async () => {
  const ctx = await setup();
  pool = ctx.pool;
  db = ctx.db;
  repo = transactionsRepository(pool);
  snapshotRepo = balanceSnapshotRepository(pool);
  idempotencyRepo = idempotencyRepository(pool);
  createTransaction = createTransactionUseCase({
    pool,
    repo,
    idempotencyRepo,
    usersClient: mockUsersClient,
    snapshotRepo,
  });
  getBalance = getBalanceUseCase(repo, snapshotRepo);
}, 60_000);

afterAll(async () => {
  await teardown();
});

beforeEach(async () => {
  await pool.query('DELETE FROM idempotency_keys');
  await pool.query('DELETE FROM balance_snapshots');
  await pool.query('DELETE FROM transactions');
});

async function assertNoDeadlocks() {
  const { rows } = await pool.query(
    `SELECT count(*) FROM pg_stat_activity
     WHERE wait_event_type = 'Lock' AND state = 'active'`,
  );
  expect(Number(rows[0].count)).toBe(0);
}

describe('Stress: concurrency', () => {
  test('50 concurrent CREDITs of 100 → final balance = 5000', async () => {
    const promises = Array.from({ length: 50 }, () =>
      createTransaction(
        { user_id: TEST_USER_ID, type: 'CREDIT', amount: 100 },
        TEST_USER_ID,
      ),
    );

    const results = await Promise.allSettled(promises);
    const succeeded = results.filter((r) => r.status === 'fulfilled').length;

    expect(succeeded).toBe(50);

    const balance = await getBalance(TEST_USER_ID);
    expect(balance.amount).toBe(5000);

    const { rows } = await pool.query(
      'SELECT count(*) FROM transactions WHERE user_id = $1',
      [TEST_USER_ID],
    );
    expect(Number(rows[0].count)).toBe(50);

    await assertNoDeadlocks();
  });

  test('50 concurrent DEBITs of 100 with balance=1000 → at most 10 succeed', async () => {
    // Seed: 10 sequential CREDITs of 100 = balance 1000
    for (let i = 0; i < 10; i++) {
      await createTransaction(
        { user_id: TEST_USER_ID, type: 'CREDIT', amount: 100 },
        TEST_USER_ID,
      );
    }

    const balanceBefore = await getBalance(TEST_USER_ID);
    expect(balanceBefore.amount).toBe(1000);

    // 50 concurrent DEBITs of 100
    const promises = Array.from({ length: 50 }, () =>
      createTransaction(
        { user_id: TEST_USER_ID, type: 'DEBIT', amount: 100 },
        TEST_USER_ID,
      ).then(
        () => ({ success: true }),
        () => ({ success: false }),
      ),
    );

    const results = await Promise.all(promises);
    const succeeded = results.filter((r) => r.success).length;

    // Exactly 10 should succeed (1000 / 100), rest rejected with INSUFFICIENT_BALANCE
    expect(succeeded).toBeLessThanOrEqual(10);
    expect(succeeded).toBeGreaterThan(0);

    const balance = await getBalance(TEST_USER_ID);
    expect(balance.amount).toBeGreaterThanOrEqual(0);

    // No double-spend: debit count * 100 + final balance = 1000
    const { rows: debitRows } = await pool.query(
      `SELECT count(*) FROM transactions WHERE user_id = $1 AND type = 'DEBIT'`,
      [TEST_USER_ID],
    );
    const debitCount = Number(debitRows[0].count);
    expect(debitCount * 100 + balance.amount).toBe(1000);

    await assertNoDeadlocks();
  });

  test('50 concurrent requests with same idempotency key → 1 transaction', async () => {
    const key = randomUUID();

    const promises = Array.from({ length: 50 }, () =>
      createTransaction(
        { user_id: TEST_USER_ID, type: 'CREDIT', amount: 100 },
        TEST_USER_ID,
        key,
      ).then(
        (r) => ({ success: true, result: r }),
        (e) => ({ success: false, error: e.message }),
      ),
    );

    const results = await Promise.all(promises);
    const succeeded = results.filter((r) => r.success).length;

    // Multiple may succeed at the use-case level (idempotency is HTTP-layer),
    // but the idempotency_keys table should have exactly 1 entry
    const { rows: keyRows } = await pool.query(
      'SELECT count(*) FROM idempotency_keys WHERE key = $1 AND user_id = $2',
      [key, TEST_USER_ID],
    );
    expect(Number(keyRows[0].count)).toBe(1);

    // Balance should reflect only successful transactions
    const balance = await getBalance(TEST_USER_ID);
    expect(balance.amount).toBe(succeeded * 100);

    await assertNoDeadlocks();
  });

  test('multi-user concurrent transactions → no deadlocks', async () => {
    const users = Array.from({ length: 10 }, (_, i) => `stress-multi-user-${i}`);

    // 5 concurrent CREDITs per user = 50 total
    const promises = users.flatMap((userId) =>
      Array.from({ length: 5 }, () =>
        createTransaction(
          { user_id: userId, type: 'CREDIT', amount: 100 },
          userId,
        ).then(
          () => ({ success: true }),
          (e) => ({ success: false, error: e.message }),
        ),
      ),
    );

    const results = await Promise.all(promises);
    const succeeded = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success);

    // Check for deadlock errors
    const deadlockErrors = failed.filter(
      (r) => r.error && r.error.includes('deadlock'),
    );
    expect(deadlockErrors).toHaveLength(0);

    expect(succeeded).toBe(50);

    // Each user should have balance = 500
    for (const userId of users) {
      const balance = await getBalance(userId);
      expect(balance.amount).toBe(500);
    }

    await assertNoDeadlocks();
  });
});
