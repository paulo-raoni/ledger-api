import { describe, test, expect, jest } from '@jest/globals';
import { getBalanceUseCase } from '../getBalance.js';
import { createTransactionUseCase } from '../createTransaction.js';

function makeSnapshotRepo(snapshot) {
  return {
    getByUserId: jest.fn(async () => snapshot),
    upsertTx: jest.fn(async () => {}),
  };
}

function makeRepo(amount = 0) {
  return {
    getBalanceByUser: jest.fn(async () => amount),
    lockUserForUpdate: jest.fn(async () => {}),
    getBalanceByUser_tx: jest.fn(async () => amount),
    insertTransactionTx: jest.fn(async (_client, data) => data),
  };
}

function makePool(balance = 0) {
  const client = {
    query: jest.fn(async (sql) => {
      if (/BEGIN|COMMIT|ROLLBACK|statement_timeout/.test(sql)) return { rows: [] };
      if (/FOR UPDATE/.test(sql)) return { rows: [{ amount: balance }] };
      if (/INSERT INTO transactions/.test(sql)) return { rows: [] };
      return { rows: [] };
    }),
    release: jest.fn(),
  };
  return {
    connect: jest.fn(async () => client),
    _client: client,
  };
}

describe('getBalanceUseCase with snapshot', () => {
  test('snapshot exists: returns snapshot value without SUM query', async () => {
    const repo = makeRepo(999);
    const snapshotRepo = makeSnapshotRepo({ amount: '500' });
    const execute = getBalanceUseCase(repo, snapshotRepo);

    const result = await execute('user-1');

    expect(snapshotRepo.getByUserId).toHaveBeenCalledWith('user-1');
    expect(repo.getBalanceByUser).not.toHaveBeenCalled();
    expect(result).toEqual({ amount: 500 });
  });

  test('snapshot is null: falls back to SUM-based calculation', async () => {
    const repo = makeRepo(42);
    const snapshotRepo = makeSnapshotRepo(null);
    const execute = getBalanceUseCase(repo, snapshotRepo);

    const result = await execute('user-1');

    expect(snapshotRepo.getByUserId).toHaveBeenCalledWith('user-1');
    expect(repo.getBalanceByUser).toHaveBeenCalledWith({ user_id: 'user-1' });
    expect(result).toEqual({ amount: 42 });
  });

  test('snapshot amount 0: returns 0 without SUM fallback', async () => {
    const repo = makeRepo(999);
    const snapshotRepo = makeSnapshotRepo({ amount: '0' });
    const execute = getBalanceUseCase(repo, snapshotRepo);

    const result = await execute('user-1');

    expect(repo.getBalanceByUser).not.toHaveBeenCalled();
    expect(result).toEqual({ amount: 0 });
  });
});

describe('createTransactionUseCase snapshot upsert', () => {
  test('CREDIT: upsertTx called with current balance + amount', async () => {
    const pool = makePool(100);
    const repo = makeRepo(100);
    repo.getBalanceByUser_tx = jest.fn(async () => 100);
    const snapshotRepo = makeSnapshotRepo(null);
    const idempotencyRepo = { saveTx: jest.fn(async () => {}) };
    const usersClient = { assertUserExists: jest.fn(async () => {}) };

    const execute = createTransactionUseCase({ pool, repo, idempotencyRepo, usersClient, snapshotRepo });
    await execute({ type: 'CREDIT', amount: 50 }, 'user-1');

    expect(snapshotRepo.upsertTx).toHaveBeenCalledTimes(1);
    const [, userId, newBalance] = snapshotRepo.upsertTx.mock.calls[0];
    expect(userId).toBe('user-1');
    expect(newBalance).toBe(150);
  });

  test('DEBIT: upsertTx called with current balance - amount', async () => {
    const pool = makePool(200);
    const repo = makeRepo(200);
    repo.getBalanceByUser_tx = jest.fn(async () => 200);
    const snapshotRepo = makeSnapshotRepo(null);
    const idempotencyRepo = { saveTx: jest.fn(async () => {}) };
    const usersClient = { assertUserExists: jest.fn(async () => {}) };

    const execute = createTransactionUseCase({ pool, repo, idempotencyRepo, usersClient, snapshotRepo });
    await execute({ type: 'DEBIT', amount: 75 }, 'user-1');

    expect(snapshotRepo.upsertTx).toHaveBeenCalledTimes(1);
    const [, userId, newBalance] = snapshotRepo.upsertTx.mock.calls[0];
    expect(userId).toBe('user-1');
    expect(newBalance).toBe(125);
  });
});
