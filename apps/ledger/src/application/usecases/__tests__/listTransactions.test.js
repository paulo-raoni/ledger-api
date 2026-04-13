import { describe, test, expect, jest } from '@jest/globals';
import { listTransactionsUseCase } from '../listTransactions.js';

function makeRepo() {
  return {
    listTransactionsByUser: jest.fn(async (args) => [{ id: 't1', ...args }]),
  };
}

describe('listTransactionsUseCase', () => {
  test('lists by authenticated user without filter', async () => {
    const repo = makeRepo();
    const execute = listTransactionsUseCase(repo);

    const result = await execute({}, 'user-1');

    expect(repo.listTransactionsByUser).toHaveBeenCalledWith({
      user_id: 'user-1',
      type: undefined,
    });

    expect(result).toEqual([{ id: 't1', user_id: 'user-1', type: undefined }]);
  });

  test('lists by authenticated user with type filter', async () => {
    const repo = makeRepo();
    const execute = listTransactionsUseCase(repo);

    const result = await execute({ type: 'CREDIT' }, 'user-1');

    expect(repo.listTransactionsByUser).toHaveBeenCalledWith({
      user_id: 'user-1',
      type: 'CREDIT',
    });

    expect(result).toEqual([{ id: 't1', user_id: 'user-1', type: 'CREDIT' }]);
  });

  test('badRequest: invalid query params', async () => {
    const repo = makeRepo();
    const execute = listTransactionsUseCase(repo);

    await expect(execute({ type: 'NOPE' }, 'user-1')).rejects.toMatchObject({
      statusCode: 400,
      code: 'BAD_REQUEST',
    });

    expect(repo.listTransactionsByUser).not.toHaveBeenCalled();
  });
});
