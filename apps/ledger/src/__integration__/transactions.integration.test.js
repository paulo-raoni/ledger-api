import { setup, teardown } from './setup.js';
import { transactionsRepository } from '../infra/repositories/transactionsRepository.js';
import { balanceSnapshotRepository } from '../infra/repositories/balanceSnapshotRepository.js';
import { idempotencyRepository } from '../infra/repositories/idempotencyRepository.js';
import { createTransactionUseCase } from '../application/usecases/createTransaction.js';
import { getBalanceUseCase } from '../application/usecases/getBalance.js';
import { randomUUID } from 'node:crypto';

let ctx;
let pool;
let repo;
let snapshotRepo;
let idempotencyRepo;
let createTransaction;
let getBalance;

const TEST_USER_ID = 'integration-user-1';

const mockUsersClient = {
  assertUserExists: async () => {},
};

beforeAll(async () => {
  ctx = await setup();
  pool = ctx.pool;
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
  await teardown(ctx);
});

beforeEach(async () => {
  await pool.query('DELETE FROM idempotency_keys');
  await pool.query('DELETE FROM balance_snapshots');
  await pool.query('DELETE FROM transactions');
});

describe('Integration: transactions', () => {
  test('CREDIT creates transaction and updates balance', async () => {
    await createTransaction(
      { user_id: TEST_USER_ID, type: 'CREDIT', amount: 500 },
      TEST_USER_ID,
    );

    const balance = await getBalance(TEST_USER_ID);
    expect(balance.amount).toBe(500);
  });

  test('CREDIT + DEBIT produces correct balance', async () => {
    await createTransaction(
      { user_id: TEST_USER_ID, type: 'CREDIT', amount: 1000 },
      TEST_USER_ID,
    );
    await createTransaction(
      { user_id: TEST_USER_ID, type: 'DEBIT', amount: 300 },
      TEST_USER_ID,
    );

    const balance = await getBalance(TEST_USER_ID);
    expect(balance.amount).toBe(700);
  });

  test('DEBIT with zero balance is rejected', async () => {
    await expect(
      createTransaction(
        { user_id: TEST_USER_ID, type: 'DEBIT', amount: 100 },
        TEST_USER_ID,
      ),
    ).rejects.toThrow('Insufficient balance');
  });

  test('idempotency key is stored in DB after transaction', async () => {
    const key = randomUUID();

    await createTransaction(
      { user_id: TEST_USER_ID, type: 'CREDIT', amount: 200 },
      TEST_USER_ID,
      key,
    );

    // Verify idempotency key was saved within the transaction
    const { rows: keyRows } = await pool.query(
      'SELECT count(*) FROM idempotency_keys WHERE key = $1 AND user_id = $2',
      [key, TEST_USER_ID],
    );
    expect(Number(keyRows[0].count)).toBe(1);

    // Second call with same key — at the use-case level, idempotency is NOT
    // enforced (the preHandler hook handles it at the HTTP layer). But the
    // idempotency_keys table uses ON CONFLICT DO NOTHING, so the second
    // saveTx call within the transaction silently skips the duplicate insert.
    await createTransaction(
      { user_id: TEST_USER_ID, type: 'CREDIT', amount: 200 },
      TEST_USER_ID,
      key,
    );

    // Still exactly 1 idempotency key entry (ON CONFLICT DO NOTHING)
    const { rows: keyRows2 } = await pool.query(
      'SELECT count(*) FROM idempotency_keys WHERE key = $1 AND user_id = $2',
      [key, TEST_USER_ID],
    );
    expect(Number(keyRows2[0].count)).toBe(1);

    // NOTE: Two transactions exist because the use case does not check
    // idempotency — that is the HTTP layer's responsibility. This test
    // verifies the DB-level constraint only.
    const { rows: txRows } = await pool.query(
      'SELECT count(*) FROM transactions WHERE user_id = $1',
      [TEST_USER_ID],
    );
    expect(Number(txRows[0].count)).toBe(2);
  });

  test('snapshot matches SUM after 10 random transactions', async () => {
    let expectedBalance = 0;

    for (let i = 0; i < 10; i++) {
      const amount = Math.floor(Math.random() * 100) + 1;

      if (i < 5) {
        await createTransaction(
          { user_id: TEST_USER_ID, type: 'CREDIT', amount },
          TEST_USER_ID,
        );
        expectedBalance += amount;
      } else {
        const debitAmount = Math.min(amount, expectedBalance);
        if (debitAmount > 0) {
          await createTransaction(
            { user_id: TEST_USER_ID, type: 'DEBIT', amount: debitAmount },
            TEST_USER_ID,
          );
          expectedBalance -= debitAmount;
        }
      }
    }

    // Compare snapshot vs SUM
    const snapshotBalance = await getBalance(TEST_USER_ID);
    const sumBalance = await repo.getBalanceByUser({ user_id: TEST_USER_ID });

    expect(snapshotBalance.amount).toBe(expectedBalance);
    expect(sumBalance).toBe(expectedBalance);
    expect(snapshotBalance.amount).toBe(sumBalance);
  });
});
