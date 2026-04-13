import { describe, test, expect, jest } from '@jest/globals';
import { createUserUseCase } from '../createUser.js';

function makeRepo() {
  return {
    findByEmail: jest.fn(async () => null),
    create: jest.fn(async (data) => ({
      id: 'u-1',
      first_name: data.first_name,
      last_name: data.last_name,
      email: data.email,
    })),
  };
}

describe('createUserUseCase', () => {
  test('success: creates user and returns safe payload (no password_hash)', async () => {
    const repo = makeRepo();
    const execute = createUserUseCase(repo);

    const result = await execute({
      first_name: 'Raoni',
      last_name: 'Dev',
      email: 'RAONI@EXAMPLE.COM ',
      password: 'Password123!',
    });

    expect(repo.findByEmail).toHaveBeenCalledWith('raoni@example.com');
    expect(repo.create).toHaveBeenCalledTimes(1);

    const createArg = repo.create.mock.calls[0][0];
    expect(createArg).toMatchObject({
      first_name: 'Raoni',
      last_name: 'Dev',
      email: 'raoni@example.com',
    });
    expect(createArg.password_hash).toBeTruthy();

    expect(result).toEqual({
      id: 'u-1',
      first_name: 'Raoni',
      last_name: 'Dev',
      email: 'raoni@example.com',
    });
    expect(result.password_hash).toBeUndefined();
  });

  test('error: duplicate email -> conflict', async () => {
    const repo = makeRepo();
    repo.findByEmail.mockResolvedValueOnce({ id: 'u-existing' });

    const execute = createUserUseCase(repo);

    await expect(
      execute({
        first_name: 'Raoni',
        last_name: 'Dev',
        email: 'raoni@example.com',
        password: 'Password123!',
      }),
    ).rejects.toMatchObject({ statusCode: 409 });

    expect(repo.create).not.toHaveBeenCalled();
  });

  test('error: invalid payload -> bad request', async () => {
    const repo = makeRepo();
    const execute = createUserUseCase(repo);

    await expect(
      execute({
        first_name: '',
        last_name: 'Dev',
        email: 'a',
        password: '123',
      }),
    ).rejects.toBeTruthy();
  });
});
