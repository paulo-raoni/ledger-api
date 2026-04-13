import { describe, test, expect, jest } from '@jest/globals';
import { createTransactionUseCase } from '../createTransaction.js';

function makeRepo() {
  return {
    insertTransaction: jest.fn(async (data) => data),
  };
}

describe('createTransactionUseCase', () => {
  test('success: inserts and returns created transaction', async () => {
    const repo = makeRepo();
    const usersClient = {
      assertUserExists: jest.fn().mockResolvedValue(undefined),
    };
    const execute = createTransactionUseCase({ repo, usersClient });

    const input = { user_id: 'user-1', type: 'CREDIT', amount: 10 };
    const result = await execute(input, 'user-1');

    expect(repo.insertTransaction).toHaveBeenCalledTimes(1);

    const arg = repo.insertTransaction.mock.calls[0][0];
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
    const repo = makeRepo();
    const execute = createTransactionUseCase(repo);

    await expect(
      execute({ user_id: 'user-1', type: 'CREDIT', amount: 0 }, 'user-1'),
    ).rejects.toMatchObject({ statusCode: 400, code: 'BAD_REQUEST' });

    expect(repo.insertTransaction).not.toHaveBeenCalled();
  });

  test('badRequest: invalid type', async () => {
    const repo = makeRepo();
    const execute = createTransactionUseCase(repo);

    await expect(
      execute({ user_id: 'user-1', type: 'NOPE', amount: 10 }, 'user-1'),
    ).rejects.toMatchObject({ statusCode: 400, code: 'BAD_REQUEST' });

    expect(repo.insertTransaction).not.toHaveBeenCalled();
  });

  test('forbidden: user_id mismatch', async () => {
    const repo = makeRepo();
    const execute = createTransactionUseCase(repo);

    await expect(
      execute({ user_id: 'user-2', type: 'DEBIT', amount: 10 }, 'user-1'),
    ).rejects.toMatchObject({ statusCode: 403, code: 'FORBIDDEN' });

    expect(repo.insertTransaction).not.toHaveBeenCalled();
  });

  test('notFound: user does not exist', async () => {
    const repo = makeRepo();
    const usersClient = {
      assertUserExists: jest
        .fn()
        .mockRejectedValue(
          Object.assign(new Error('User not found'), { statusCode: 404, code: 'NOT_FOUND' }),
        ),
    };
    const execute = createTransactionUseCase({ repo, usersClient });

    await expect(
      execute({ user_id: 'user-1', type: 'CREDIT', amount: 10 }, 'user-1'),
    ).rejects.toMatchObject({ statusCode: 404, code: 'NOT_FOUND' });

    expect(repo.insertTransaction).not.toHaveBeenCalled();
  });
});
