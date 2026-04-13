import { describe, test, expect, jest } from '@jest/globals';
import { getUserUseCase } from '../getUser.js';

function makeRepo() {
  return {
    findById: jest.fn(async () => null),
  };
}

describe('getUserUseCase', () => {
  test('success: returns user by id', async () => {
    const repo = makeRepo();
    repo.findById.mockResolvedValueOnce({
      id: 'u-1',
      first_name: 'Raoni',
      last_name: 'Dev',
      email: 'raoni@example.com',
    });

    const execute = getUserUseCase(repo);

    const result = await execute({ id: 'u-1' });

    expect(repo.findById).toHaveBeenCalledWith('u-1');
    expect(result).toHaveProperty('id', 'u-1');
  });

  test('error: not found -> notFound', async () => {
    const repo = makeRepo();
    const execute = getUserUseCase(repo);

    await expect(execute({ id: 'missing' })).rejects.toMatchObject({ statusCode: 404 });
  });

  test('error: invalid params -> throws', async () => {
    const repo = makeRepo();
    const execute = getUserUseCase(repo);

    await expect(execute({ id: '' })).rejects.toBeTruthy();
  });
});
