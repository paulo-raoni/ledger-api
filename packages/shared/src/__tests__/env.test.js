import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { mustGetEnv } from '../env.js';

describe('mustGetEnv', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('returns the value when env var is present', () => {
    process.env.TEST_VAR = 'hello';
    expect(mustGetEnv('TEST_VAR')).toBe('hello');
  });

  it('throws when env var is missing', () => {
    delete process.env.TEST_VAR;
    expect(() => mustGetEnv('TEST_VAR')).toThrow('Missing required env var: TEST_VAR');
  });

  it('throws when env var is empty string', () => {
    process.env.TEST_VAR = '';
    expect(() => mustGetEnv('TEST_VAR')).toThrow('Missing required env var: TEST_VAR');
  });

  it('throws when env var is only whitespace', () => {
    process.env.TEST_VAR = '   ';
    expect(() => mustGetEnv('TEST_VAR')).toThrow('Missing required env var: TEST_VAR');
  });
});
