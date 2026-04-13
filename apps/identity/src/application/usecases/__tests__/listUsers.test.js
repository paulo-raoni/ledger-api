import { describe, test, expect, jest } from '@jest/globals';
import { listUsersUseCase } from '../listUsers.js';

function makeRepo() {
  return {
    list: jest.fn(async () => [{ id: 'u-1', first_name: 'A', last_name: 'B', email: 'a@b.com' }]),
  };
}

describe('listUsersUseCase', () => {
  test('success: returns list from repo', async () => {
    const repo = makeRepo();
    const execute = listUsersUseCase(repo);

    const result = await execute();

    expect(repo.list).toHaveBeenCalledTimes(1);
    expect(result).toHaveLength(1);
    expect(result[0]).toHaveProperty('id', 'u-1');
  });
});
