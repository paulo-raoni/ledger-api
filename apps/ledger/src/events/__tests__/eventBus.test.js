/**
 * Spec §7 — listener baseline: register N send handlers, call all cleanup
 * handlers, assert listenerCount returns to 0.
 *
 * Spec §8 — per-user filter: two fake streams with different user.sub each
 * only receive events for their own user.
 */
import { describe, test, expect, afterEach } from '@jest/globals';
import { eventBus } from '../eventBus.js';

// Clean up any listeners added by tests so they do not bleed between suites.
afterEach(() => {
  eventBus.removeAllListeners('event');
});

// ---------------------------------------------------------------------------
// §7 — Listener baseline
// ---------------------------------------------------------------------------
describe('listener baseline', () => {
  test('listenerCount returns to 0 after all cleanup handlers run', () => {
    const N = 5;
    const cleanups = [];

    for (let i = 0; i < N; i++) {
      const send = () => {};
      eventBus.on('event', send);
      cleanups.push(() => eventBus.off('event', send));
    }

    expect(eventBus.listenerCount('event')).toBe(N);

    for (const cleanup of cleanups) cleanup();

    expect(eventBus.listenerCount('event')).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// §8 — Per-user filter (simulates the send() function inside events.js)
// ---------------------------------------------------------------------------
describe('per-user filter', () => {
  /**
   * Simulate the send() function that the /events handler registers:
   *   if (event.userId !== user.sub) return;
   *   received.push(event);
   */
  function makeStream(userId) {
    const received = [];
    const send = (event) => {
      if (event.userId !== userId) return;
      received.push(event);
    };
    return { send, received };
  }

  test('each stream only receives events for its own user', () => {
    const streamA = makeStream('user-A');
    const streamB = makeStream('user-B');

    eventBus.on('event', streamA.send);
    eventBus.on('event', streamB.send);

    // Emit one event for each user plus one for an unrelated third user.
    eventBus.emit('event', { type: 'request', userId: 'user-A', timestamp: 1 });
    eventBus.emit('event', { type: 'request', userId: 'user-B', timestamp: 2 });
    eventBus.emit('event', { type: 'request', userId: 'user-C', timestamp: 3 });

    // Stream A only sees its own event.
    expect(streamA.received).toHaveLength(1);
    expect(streamA.received[0].userId).toBe('user-A');

    // Stream B only sees its own event.
    expect(streamB.received).toHaveLength(1);
    expect(streamB.received[0].userId).toBe('user-B');

    // Cleanup.
    eventBus.off('event', streamA.send);
    eventBus.off('event', streamB.send);
    expect(eventBus.listenerCount('event')).toBe(0);
  });

  test('emit() helper attaches timestamp and service if missing', async () => {
    const { emit } = await import('../eventBus.js');
    const received = [];
    const listener = (e) => received.push(e);
    eventBus.on('event', listener);

    emit({ type: 'request', userId: 'u1' });

    expect(received).toHaveLength(1);
    expect(typeof received[0].timestamp).toBe('number');
    expect(received[0].service).toBe('ledger');

    eventBus.off('event', listener);
  });

  test('emit() does not overwrite existing timestamp and service', async () => {
    const { emit } = await import('../eventBus.js');
    const received = [];
    const listener = (e) => received.push(e);
    eventBus.on('event', listener);

    emit({ type: 'request', userId: 'u1', timestamp: 9999, service: 'custom' });

    expect(received[0].timestamp).toBe(9999);
    expect(received[0].service).toBe('custom');

    eventBus.off('event', listener);
  });
});
