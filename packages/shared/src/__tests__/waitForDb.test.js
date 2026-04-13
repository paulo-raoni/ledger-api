import { jest, describe, it, expect, beforeAll } from '@jest/globals';
import { waitForDb } from '../waitForDb.js';

beforeAll(() => {
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

describe('waitForDb', () => {
  it('resolves immediately when db is ready on first attempt', async () => {
    const pool = { query: jest.fn().mockResolvedValue({ rows: [{ '?column?': 1 }] }) };
    await expect(waitForDb(pool, { retries: 3, delayMs: 0 })).resolves.toBeUndefined();
    expect(pool.query).toHaveBeenCalledTimes(1);
    expect(pool.query).toHaveBeenCalledWith('SELECT 1');
  });

  it('retries and resolves when db becomes ready on a later attempt', async () => {
    let callCount = 0;
    const pool = {
      query: jest.fn().mockImplementation(() => {
        callCount++;
        if (callCount < 3)
          return Promise.reject(Object.assign(new Error('ECONNREFUSED'), { code: 'ECONNREFUSED' }));
        return Promise.resolve({ rows: [] });
      }),
    };
    await expect(waitForDb(pool, { retries: 5, delayMs: 0 })).resolves.toBeUndefined();
    expect(pool.query).toHaveBeenCalledTimes(3);
  });

  it('throws after all retries are exhausted', async () => {
    const dbError = Object.assign(new Error('ECONNREFUSED'), { code: 'ECONNREFUSED' });
    const pool = { query: jest.fn().mockRejectedValue(dbError) };
    await expect(waitForDb(pool, { retries: 3, delayMs: 0 })).rejects.toThrow('ECONNREFUSED');
    expect(pool.query).toHaveBeenCalledTimes(3);
  });
});
