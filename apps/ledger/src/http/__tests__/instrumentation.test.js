/**
 * Tests for the instrumentation hooks.
 *
 * Spec §6 — feedback-loop guard: /events and /health requests must NOT emit
 * events on the bus.
 * Spec §6 — missing-user guard: requests without request.user.sub must NOT
 * emit events.
 */
import { describe, test, expect, jest } from '@jest/globals';
import { __test__, registerInstrumentation } from '../instrumentation.js';
import { eventBus } from '../../events/eventBus.js';

const { shouldSkip } = __test__;

// ---------------------------------------------------------------------------
// Unit tests for the skip predicate
// ---------------------------------------------------------------------------
describe('shouldSkip predicate', () => {
  test('skips /events route', () => {
    expect(shouldSkip({ routerPath: '/events', user: { sub: 'u1' } })).toBe(true);
  });

  test('skips /health route', () => {
    expect(shouldSkip({ routerPath: '/health', user: { sub: 'u1' } })).toBe(true);
  });

  test('skips when routerPath is undefined (early lifecycle)', () => {
    expect(shouldSkip({ routerPath: undefined, user: { sub: 'u1' } })).toBe(true);
  });

  test('skips when request.user is absent', () => {
    expect(shouldSkip({ routerPath: '/transactions' })).toBe(true);
  });

  test('skips when request.user.sub is falsy', () => {
    expect(shouldSkip({ routerPath: '/transactions', user: {} })).toBe(true);
  });

  test('does NOT skip normal authenticated routes', () => {
    expect(shouldSkip({ routerPath: '/transactions', user: { sub: 'u1' } })).toBe(false);
  });

  test('does NOT skip /balance route', () => {
    expect(shouldSkip({ routerPath: '/balance', user: { sub: 'u-abc' } })).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Hook-level tests: verify eventBus.emit is NOT called for skip paths.
// Uses a minimal fake Fastify that captures registered hooks so we can call
// them synchronously without standing up an HTTP server.
// ---------------------------------------------------------------------------
function makeFakeFastify() {
  const hooks = {};
  return {
    addHook(name, fn) { hooks[name] = fn; },
    _hooks: hooks,
  };
}

describe('instrumentation hooks — feedback-loop guard', () => {
  test('/events onRequest does not emit on the bus', () => {
    const emitSpy = jest.spyOn(eventBus, 'emit');
    const fake = makeFakeFastify();
    registerInstrumentation(fake);

    const done = jest.fn();
    fake._hooks['onRequest'](
      { routerPath: '/events', user: { sub: 'u1' } },
      {},
      done,
    );

    expect(done).toHaveBeenCalledTimes(1);
    expect(emitSpy).not.toHaveBeenCalled();
    emitSpy.mockRestore();
  });

  test('/health onRequest does not emit on the bus', () => {
    const emitSpy = jest.spyOn(eventBus, 'emit');
    const fake = makeFakeFastify();
    registerInstrumentation(fake);

    const done = jest.fn();
    fake._hooks['onRequest'](
      { routerPath: '/health', user: { sub: 'u1' } },
      {},
      done,
    );

    expect(done).toHaveBeenCalledTimes(1);
    expect(emitSpy).not.toHaveBeenCalled();
    emitSpy.mockRestore();
  });

  test('unauthenticated request does not emit on the bus', () => {
    const emitSpy = jest.spyOn(eventBus, 'emit');
    const fake = makeFakeFastify();
    registerInstrumentation(fake);

    const done = jest.fn();
    fake._hooks['onRequest'](
      { routerPath: '/transactions' }, // no user
      {},
      done,
    );

    expect(done).toHaveBeenCalledTimes(1);
    expect(emitSpy).not.toHaveBeenCalled();
    emitSpy.mockRestore();
  });
});
