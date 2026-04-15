import { describe, test, expect, jest } from '@jest/globals';
import { createTransactionUseCase } from '../createTransaction.js';

function makeClient(balanceAmount = 1000) {
  return {
    query: jest.fn(async (sql) => {
      if (/pg_advisory_xact_lock/.test(sql)) {
        return { rows: [] };
      }
      if (/COALESCE\(SUM/.test(sql)) {
        return { rows: [{ amount: balanceAmount }] };
      }
      if (/INSERT INTO transactions/.test(sql)) {
        return { rows: [{ id: 'tx-id', user_id: 'user-1', type: 'CREDIT', amount: 10 }] };
      }
      return { rows: [] };
    }),
    release: jest.fn(),
  };
}

function makePool(client) {
  return {
    connect: jest.fn(async () => client),
  };
}

function makeRepo(client) {
  return {
    insertTransaction: jest.fn(async (data) => data),
    lockUserForUpdate: jest.fn(async () => {}),
    getBalanceByUser_tx: jest.fn(async () => client._balance ?? 1000),
    insertTransactionTx: jest.fn(async (_client, data) => data),
  };
}

function makeIdempotencyRepo() {
  return {
    saveTx: jest.fn(async () => {}),
  };
}

function makeSnapshotRepo() {
  return {
    upsertTx: jest.fn(async () => {}),
  };
}

describe('createTransactionUseCase', () => {
  test('success: inserts and returns created transaction', async () => {
    const client = makeClient(1000);
    const pool = makePool(client);
    const repo = {
      insertTransaction: jest.fn(async (data) => data),
      lockUserForUpdate: jest.fn(async () => {}),
      getBalanceByUser_tx: jest.fn(async () => 1000),
      insertTransactionTx: jest.fn(async (_client, data) => data),
    };
    const idempotencyRepo = makeIdempotencyRepo();
    const snapshotRepo = makeSnapshotRepo();
    const usersClient = {
      assertUserExists: jest.fn().mockResolvedValue(undefined),
    };
    const execute = createTransactionUseCase({ pool, repo, idempotencyRepo, usersClient, snapshotRepo });

    const input = { type: 'CREDIT', amount: 10 };
    const result = await execute(input, 'user-1');

    expect(repo.insertTransactionTx).toHaveBeenCalledTimes(1);

    const [, arg] = repo.insertTransactionTx.mock.calls[0];
    expect(arg).toMatchObject({
      user_id: 'user-1',
      type: 'CREDIT',
      amount: 10,
    });

    expect(typeof arg.id).toBe('string');
    expect(arg.id.length).toBeGreaterThan(10);

    expect(result).toEqual(arg);
  });

  test('badRequest: invalid amount', async () => {
    const client = makeClient();
    const pool = makePool(client);
    const repo = makeRepo(client);
    const idempotencyRepo = makeIdempotencyRepo();
    const execute = createTransactionUseCase({ pool, repo, idempotencyRepo });

    await expect(
      execute({ type: 'CREDIT', amount: 0 }, 'user-1'),
    ).rejects.toMatchObject({ statusCode: 400, code: 'BAD_REQUEST' });

    expect(repo.insertTransactionTx).not.toHaveBeenCalled();
  });

  test('badRequest: invalid type', async () => {
    const client = makeClient();
    const pool = makePool(client);
    const repo = makeRepo(client);
    const idempotencyRepo = makeIdempotencyRepo();
    const execute = createTransactionUseCase({ pool, repo, idempotencyRepo });

    await expect(
      execute({ type: 'NOPE', amount: 10 }, 'user-1'),
    ).rejects.toMatchObject({ statusCode: 400, code: 'BAD_REQUEST' });

    expect(repo.insertTransactionTx).not.toHaveBeenCalled();
  });

  test('notFound: user does not exist', async () => {
    const client = makeClient();
    const pool = makePool(client);
    const repo = makeRepo(client);
    const idempotencyRepo = makeIdempotencyRepo();
    const usersClient = {
      assertUserExists: jest
        .fn()
        .mockRejectedValue(
          Object.assign(new Error('User not found'), { statusCode: 404, code: 'NOT_FOUND' }),
        ),
    };
    const execute = createTransactionUseCase({ pool, repo, idempotencyRepo, usersClient });

    await expect(
      execute({ type: 'CREDIT', amount: 10 }, 'user-1'),
    ).rejects.toMatchObject({ statusCode: 404, code: 'NOT_FOUND' });

    expect(repo.insertTransactionTx).not.toHaveBeenCalled();
  });
});
