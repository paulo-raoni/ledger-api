import { describe, test, expect, jest } from '@jest/globals';
import { createTransactionUseCase } from '../createTransaction.js';

function makeClient(overrides = {}) {
  return {
    query: jest.fn(async () => ({ rows: [] })),
    release: jest.fn(),
    ...overrides,
  };
}

function makePool(client) {
  return {
    connect: jest.fn(async () => client),
  };
}

function makeRepo(balance = 1000) {
  return {
    getBalanceByUserForUpdate: jest.fn(async () => balance),
    insertTransactionTx: jest.fn(async (_client, data) => ({ ...data })),
  };
}

function makeIdempotencyRepo() {
  return {
    saveTx: jest.fn(async () => {}),
  };
}

function makeUsersClient() {
  return {
    assertUserExists: jest.fn(async () => undefined),
  };
}

function makeSnapshotRepo() {
  return {
    upsertTx: jest.fn(async () => {}),
  };
}

describe('createTransactionUseCase — ACID tests', () => {
  test('DEBIT with insufficient balance returns INSUFFICIENT_BALANCE error', async () => {
    const client = makeClient();
    const pool = makePool(client);
    const repo = makeRepo(50);
    const idempotencyRepo = makeIdempotencyRepo();
    const usersClient = makeUsersClient();

    const execute = createTransactionUseCase({ pool, repo, idempotencyRepo, usersClient });

    await expect(
      execute({ user_id: 'user-1', type: 'DEBIT', amount: 100 }, 'user-1'),
    ).rejects.toMatchObject({ statusCode: 422, code: 'INSUFFICIENT_BALANCE' });

    expect(repo.insertTransactionTx).not.toHaveBeenCalled();
  });

  test('CREDIT always succeeds regardless of balance', async () => {
    const client = makeClient();
    const pool = makePool(client);
    const repo = makeRepo(0);
    const idempotencyRepo = makeIdempotencyRepo();
    const usersClient = makeUsersClient();
    const snapshotRepo = makeSnapshotRepo();

    const execute = createTransactionUseCase({ pool, repo, idempotencyRepo, usersClient, snapshotRepo });

    const result = await execute({ user_id: 'user-1', type: 'CREDIT', amount: 500 }, 'user-1');

    expect(repo.insertTransactionTx).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({ user_id: 'user-1', type: 'CREDIT', amount: 500 });
  });

  test('transaction is rolled back on error after INSERT', async () => {
    const client = makeClient();
    const pool = makePool(client);
    const repo = {
      getBalanceByUserForUpdate: jest.fn(async () => 1000),
      insertTransactionTx: jest.fn(async () => {
        throw new Error('DB write failure');
      }),
    };
    const idempotencyRepo = makeIdempotencyRepo();
    const usersClient = makeUsersClient();

    const execute = createTransactionUseCase({ pool, repo, idempotencyRepo, usersClient });

    await expect(
      execute({ user_id: 'user-1', type: 'CREDIT', amount: 100 }, 'user-1'),
    ).rejects.toThrow('DB write failure');

    const queryCalls = client.query.mock.calls.map((c) => c[0]);
    expect(queryCalls).toContain('BEGIN');
    expect(queryCalls).toContain('ROLLBACK');
    expect(queryCalls).not.toContain('COMMIT');
    expect(client.release).toHaveBeenCalledTimes(1);
  });

  test('statement_timeout is set within transaction', async () => {
    const client = makeClient();
    const pool = makePool(client);
    const repo = makeRepo(1000);
    const idempotencyRepo = makeIdempotencyRepo();
    const usersClient = makeUsersClient();
    const snapshotRepo = makeSnapshotRepo();

    const execute = createTransactionUseCase({ pool, repo, idempotencyRepo, usersClient, snapshotRepo });

    await execute({ user_id: 'user-1', type: 'CREDIT', amount: 100 }, 'user-1');

    const queryCalls = client.query.mock.calls.map((c) => c[0]);
    expect(queryCalls).toContain('SET LOCAL statement_timeout = 5000');
  });

  test('idempotency key is saved within the same transaction', async () => {
    const client = makeClient();
    const pool = makePool(client);
    const repo = makeRepo(1000);
    const idempotencyRepo = makeIdempotencyRepo();
    const usersClient = makeUsersClient();
    const snapshotRepo = makeSnapshotRepo();

    const execute = createTransactionUseCase({ pool, repo, idempotencyRepo, usersClient, snapshotRepo });

    await execute({ user_id: 'user-1', type: 'CREDIT', amount: 100 }, 'user-1', 'idem-key-abc');

    expect(idempotencyRepo.saveTx).toHaveBeenCalledTimes(1);
    const [savedClient, savedKey, savedUserId] = idempotencyRepo.saveTx.mock.calls[0];
    expect(savedClient).toBe(client);
    expect(savedKey).toBe('idem-key-abc');
    expect(savedUserId).toBe('user-1');
  });

  test('idempotency key is not saved when not provided', async () => {
    const client = makeClient();
    const pool = makePool(client);
    const repo = makeRepo(1000);
    const idempotencyRepo = makeIdempotencyRepo();
    const usersClient = makeUsersClient();
    const snapshotRepo = makeSnapshotRepo();

    const execute = createTransactionUseCase({ pool, repo, idempotencyRepo, usersClient, snapshotRepo });

    await execute({ user_id: 'user-1', type: 'CREDIT', amount: 100 }, 'user-1');

    expect(idempotencyRepo.saveTx).not.toHaveBeenCalled();
  });

  test('SELECT FOR UPDATE is called for both CREDIT and DEBIT', async () => {
    const client = makeClient();
    const pool = makePool(client);
    const repo = makeRepo(1000);
    const idempotencyRepo = makeIdempotencyRepo();
    const usersClient = makeUsersClient();
    const snapshotRepo = makeSnapshotRepo();

    const execute = createTransactionUseCase({ pool, repo, idempotencyRepo, usersClient, snapshotRepo });

    await execute({ user_id: 'user-1', type: 'DEBIT', amount: 50 }, 'user-1');

    expect(repo.getBalanceByUserForUpdate).toHaveBeenCalledWith(client, 'user-1');
  });
});
