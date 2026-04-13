import { describe, test, expect, jest } from '@jest/globals';
import { getBalanceUseCase } from '../getBalance.js';

function makeRepo(amount) {
  return {
    getBalanceByUser: jest.fn(async () => amount),
  };
}

describe('getBalanceUseCase', () => {
  test('returns numeric amount', async () => {
    const repo = makeRepo(42);
    const execute = getBalanceUseCase(repo);

    const result = await execute('user-1');

    expect(repo.getBalanceByUser).toHaveBeenCalledWith({ user_id: 'user-1' });
    expect(result).toEqual({ amount: 42 });
  });

  test('returns 0 when repository returns 0', async () => {
    const repo = makeRepo(0);
    const execute = getBalanceUseCase(repo);

    const result = await execute('user-1');

    expect(result).toEqual({ amount: 0 });
  });

  test('credit minus debit math: returns net balance', async () => {
    const repo = makeRepo(90);
    const execute = getBalanceUseCase(repo);

    const result = await execute('user-1');

    expect(result).toEqual({ amount: 90 });
  });
});
