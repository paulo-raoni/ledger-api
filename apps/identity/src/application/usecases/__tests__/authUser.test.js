import { describe, test, expect, jest, beforeEach, afterEach } from '@jest/globals';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { authUserUseCase } from '../authUser.js';

function makeRepo() {
  return {
    findByEmail: jest.fn(async () => null),
  };
}

describe('authUserUseCase', () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    process.env = { ...OLD_ENV, JWT_EXTERNAL_SECRET: 'TEST_EXTERNAL_SECRET' };
  });

  afterEach(() => {
    process.env = OLD_ENV;
  });

  test('success: returns user + access_token', async () => {
    const repo = makeRepo();

    const password_hash = await bcrypt.hash('Password123!', 10);
    repo.findByEmail.mockResolvedValueOnce({
      id: 'u-1',
      first_name: 'Raoni',
      last_name: 'Dev',
      email: 'raoni@example.com',
      password_hash,
    });

    const execute = authUserUseCase(repo);

    const result = await execute({
      user: { email: ' RAONI@EXAMPLE.COM ', password: 'Password123!' },
    });

    expect(repo.findByEmail).toHaveBeenCalledWith('raoni@example.com');
    expect(result).toHaveProperty('access_token');
    expect(result).toHaveProperty('user');
    expect(result.user).toEqual({
      id: 'u-1',
      first_name: 'Raoni',
      last_name: 'Dev',
      email: 'raoni@example.com',
    });

    const decoded = jwt.verify(result.access_token, process.env.JWT_EXTERNAL_SECRET);
    expect(decoded).toHaveProperty('sub', 'u-1');
  });

  test('error: unknown email -> unauthorized', async () => {
    const repo = makeRepo();
    const execute = authUserUseCase(repo);

    await expect(
      execute({ user: { email: 'x@example.com', password: 'Password123!' } }),
    ).rejects.toMatchObject({ statusCode: 401 });
  });

  test('error: wrong password -> unauthorized', async () => {
    const repo = makeRepo();
    const password_hash = await bcrypt.hash('Password123!', 10);

    repo.findByEmail.mockResolvedValueOnce({
      id: 'u-1',
      first_name: 'Raoni',
      last_name: 'Dev',
      email: 'raoni@example.com',
      password_hash,
    });

    const execute = authUserUseCase(repo);

    await expect(
      execute({ user: { email: 'raoni@example.com', password: 'WRONG' } }),
    ).rejects.toMatchObject({ statusCode: 401 });
  });

  test('success: accepts flat payload and normalizes email (trim + lowercase)', async () => {
    const repo = makeRepo();

    const password_hash = await bcrypt.hash('Password123!', 10);
    repo.findByEmail.mockResolvedValueOnce({
      id: 'u-1',
      first_name: 'Raoni',
      last_name: 'Dev',
      email: 'raoni@example.com',
      password_hash,
    });

    const execute = authUserUseCase(repo);

    const result = await execute({
      email: '  RAONI@EXAMPLE.COM  ',
      password: 'Password123!',
    });

    expect(repo.findByEmail).toHaveBeenCalledWith('raoni@example.com');
    expect(result).toHaveProperty('access_token');
  });
});
