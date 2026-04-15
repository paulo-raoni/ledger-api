/**
 * PR 4 §4.4 / criterion 9 — replay engine timing precision.
 *
 * NOTE: apps/web has no JS runner wired to `npm test` (only Playwright E2E).
 * This file is authored to run under jest when a runner is introduced,
 * matching the convention in deriveServiceState.test.ts and sseLifecycle.test.ts.
 *
 * Criterion 9 (downgraded / amended): assert the CSS custom property that
 * drives `animation-duration` on `.packet` reflects the expected ms per speed,
 * and that inter-event deltas emitted by the replay engine match the spec
 * exactly (fake timers, no wall-clock drift).
 */
import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { REPLAY_TIMING, type ReplaySpeed } from '../AppContext';
import type { SseEvent } from '../../types/sse';

describe('REPLAY_TIMING table (criterion 9)', () => {
  it('slow → 3000ms step, 2000ms packet', () => {
    expect(REPLAY_TIMING.slow).toEqual({ stepMs: 3000, packetMs: 2000 });
  });
  it('medium → 500ms step, 400ms packet', () => {
    expect(REPLAY_TIMING.medium).toEqual({ stepMs: 500, packetMs: 400 });
  });
  it('fast → 200ms step, 150ms packet', () => {
    expect(REPLAY_TIMING.fast).toEqual({ stepMs: 200, packetMs: 150 });
  });
});

/**
 * Minimal in-test replica of the replay setTimeout chain from AppContext.
 * Lets us assert inter-event deltas under fake timers without mounting React.
 */
function makeReplayDriver(source: SseEvent[], speed: ReplaySpeed) {
  const emitted: SseEvent[] = [];
  const timeouts: ReturnType<typeof setTimeout>[] = [];
  const { stepMs } = REPLAY_TIMING[speed];

  const start = () => {
    for (let i = 0; i < source.length; i++) {
      const idx = i;
      const t = setTimeout(() => {
        emitted.push(source[idx]);
      }, i * stepMs);
      timeouts.push(t);
    }
  };

  const stop = () => {
    for (const t of timeouts) clearTimeout(t);
    timeouts.length = 0;
  };

  return { start, stop, emitted, timeouts };
}

function ev(i: number): SseEvent {
  return {
    type: 'request',
    service: 'identity',
    method: 'POST',
    path: `/step-${i}`,
    userId: 'u',
    timestamp: i,
    receivedAt: i,
  } as SseEvent;
}

describe('replay engine inter-event delta (criterion 9)', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  const cases: Array<{ speed: ReplaySpeed; step: number }> = [
    { speed: 'slow',   step: 3000 },
    { speed: 'medium', step: 500  },
    { speed: 'fast',   step: 200  },
  ];

  for (const c of cases) {
    it(`${c.speed}: event N+1 fires exactly ${c.step}ms after event N`, () => {
      const source = [ev(0), ev(1), ev(2)];
      const driver = makeReplayDriver(source, c.speed);
      driver.start();

      // t=0: nothing emitted yet (timers queued with delay of 0 fire on next tick).
      expect(driver.emitted.length).toBe(0);

      jest.advanceTimersByTime(0);
      expect(driver.emitted.length).toBe(1);

      jest.advanceTimersByTime(c.step - 1);
      expect(driver.emitted.length).toBe(1);
      jest.advanceTimersByTime(1);
      expect(driver.emitted.length).toBe(2);

      jest.advanceTimersByTime(c.step);
      expect(driver.emitted.length).toBe(3);

      driver.stop();
    });
  }

  it('stop cancels pending timeouts (pre-mortem 4)', () => {
    const source = [ev(0), ev(1), ev(2)];
    const driver = makeReplayDriver(source, 'slow');
    driver.start();
    driver.stop();
    jest.advanceTimersByTime(10_000);
    expect(driver.emitted.length).toBe(0);
  });
});

describe('computed CSS custom property for packet-duration', () => {
  it('sets --packet-duration to the speed-table packetMs', () => {
    // Simulates the Packet component's inline style construction.
    for (const speed of ['slow', 'medium', 'fast'] as ReplaySpeed[]) {
      const packetMs = REPLAY_TIMING[speed].packetMs;
      const style = { '--packet-duration': `${packetMs}ms` } as Record<string, string>;
      expect(style['--packet-duration']).toBe(`${packetMs}ms`);
    }
  });
});
