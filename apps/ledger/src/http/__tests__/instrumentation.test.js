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

// ---------------------------------------------------------------------------
// Fix 1d (M5 PR 1): every emitted event envelope carries a requestId — 6 hex.
// ---------------------------------------------------------------------------
describe('instrumentation hooks — requestId on SSE envelopes (Fix 1d)', () => {
  test('onRequest attaches request.requestId and emits it on the request event', () => {
    const received = [];
    const listener = (e) => received.push(e);
    eventBus.on('event', listener);

    const fake = makeFakeFastify();
    registerInstrumentation(fake);

    const request = { routerPath: '/transactions', method: 'POST', user: { sub: 'u1' } };
    const done = jest.fn();
    fake._hooks['onRequest'](request, {}, done);

    expect(done).toHaveBeenCalledTimes(1);
    expect(request.requestId).toMatch(/^[0-9a-f]{6}$/);
    expect(received).toHaveLength(1);
    expect(received[0].type).toBe('request');
    expect(received[0].requestId).toBe(request.requestId);
    expect(received[0].requestId).toMatch(/^[0-9a-f]{6}$/);

    eventBus.off('event', listener);
  });

  test('onResponse emits the same requestId set by onRequest', () => {
    const received = [];
    const listener = (e) => received.push(e);
    eventBus.on('event', listener);

    const fake = makeFakeFastify();
    registerInstrumentation(fake);

    const request = { routerPath: '/transactions', method: 'POST', user: { sub: 'u1' } };
    fake._hooks['onRequest'](request, {}, jest.fn());
    fake._hooks['onResponse'](request, { statusCode: 200, elapsedTime: 5 }, jest.fn());

    const responseEvent = received.find((e) => e.type === 'response');
    expect(responseEvent).toBeDefined();
    expect(responseEvent.requestId).toBe(request.requestId);
    expect(responseEvent.requestId).toMatch(/^[0-9a-f]{6}$/);

    eventBus.off('event', listener);
  });
});
