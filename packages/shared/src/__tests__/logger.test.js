import { jest, describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { logger } from '../logger.js';

describe('logger', () => {
  let logSpy;
  let warnSpy;
  let errorSpy;

  beforeEach(() => {
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    logSpy.mockRestore();
    warnSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it('info calls console.log with [INFO] prefix', () => {
    logger.info('test message');
    expect(logSpy).toHaveBeenCalledTimes(1);
    const firstArg = logSpy.mock.calls[0][0];
    expect(firstArg).toMatch(/^\[INFO\]/);
  });

  it('warn calls console.warn with [WARN] prefix', () => {
    logger.warn('test warning');
    expect(warnSpy).toHaveBeenCalledTimes(1);
    const firstArg = warnSpy.mock.calls[0][0];
    expect(firstArg).toMatch(/^\[WARN\]/);
  });

  it('error calls console.error with [ERROR] prefix', () => {
    logger.error('test error');
    expect(errorSpy).toHaveBeenCalledTimes(1);
    const firstArg = errorSpy.mock.calls[0][0];
    expect(firstArg).toMatch(/^\[ERROR\]/);
  });

  it('info passes additional arguments through', () => {
    logger.info('msg', { key: 'value' });
    expect(logSpy).toHaveBeenCalledTimes(1);
    expect(logSpy.mock.calls[0]).toContain('msg');
  });

  it('error passes additional arguments through', () => {
    const err = new Error('boom');
    logger.error('failed', err);
    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy.mock.calls[0]).toContain(err);
  });
});
