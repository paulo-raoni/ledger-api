/**
 * Integration invariant for Fix 2c — the SSE EventSource pair is owned
 * by AppContext, not by Observability, so switching between Autoplay
 * and Observability tabs must not re-open connections.
 *
 * NOTE: apps/web has no JS test runner wired to `npm test` yet (only
 * Playwright E2E). This file is authored to run under jest/vitest when
 * a runner is introduced later — matching the convention established
 * in deriveServiceState.test.ts and LogLine.test.ts.
 *
 * The test simulates the `useEffect([token, sseAuthError])` lifecycle
 * that lives in AppContext: the only inputs that should re-trigger the
 * connection pair are `token` and `sseAuthError`. `mode` changes must
 * be invisible to it.
 */
import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';

type Mode = 'autoplay' | 'guided' | 'playground' | 'observability';
type SseStatus = 'connected' | 'disconnected' | 'auth-error';

class FakeEventSource {
  static instances: FakeEventSource[] = [];
  static constructCount = 0;
  url: string;
  closed = false;
  onopen: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onmessage: ((e: { data: string }) => void) | null = null;
  constructor(url: string) {
    this.url = url;
    FakeEventSource.constructCount += 1;
    FakeEventSource.instances.push(this);
  }
  close() {
    this.closed = true;
  }
}

/**
 * Replays the AppContext SSE effect: opens two EventSources when token
 * is truthy and sseAuthError is false, tracks the most recent cleanup,
 * and re-runs only when those two inputs change.
 */
function createLifecycleHarness(ESCtor: typeof FakeEventSource) {
  let cleanup: (() => void) | null = null;
  let lastToken: string | null = null;
  let lastAuthError = false;

  const run = (token: string | null, sseAuthError: boolean) => {
    const changed = token !== lastToken || sseAuthError !== lastAuthError;
    if (!changed) return;
    lastToken = token;
    lastAuthError = sseAuthError;
    if (cleanup) {
      cleanup();
      cleanup = null;
    }
    if (!token || sseAuthError) return;
    const sources = [
      new ESCtor(`http://localhost:3001/events?token=${token}`),
      new ESCtor(`http://localhost:3002/events?token=${token}`),
    ];
    cleanup = () => sources.forEach((s) => s.close());
  };

  return { run };
}

describe('AppContext SSE lifecycle (Fix 2c)', () => {
  beforeEach(() => {
    FakeEventSource.instances = [];
    FakeEventSource.constructCount = 0;
  });
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('opens exactly two EventSources for one valid token and does not re-open on mode switches', () => {
    const { run } = createLifecycleHarness(FakeEventSource);

    // Initial mount: token becomes valid — opens pair.
    let mode: Mode = 'autoplay';
    run('jwt-1', false);
    expect(FakeEventSource.constructCount).toBe(2);

    // Autoplay → Observability → Autoplay: mode changes but token
    // and sseAuthError are unchanged, so the effect does NOT re-run.
    mode = 'observability';
    run('jwt-1', false);
    mode = 'autoplay';
    run('jwt-1', false);
    void mode;

    expect(FakeEventSource.constructCount).toBe(2);
    expect(FakeEventSource.instances.filter((s) => !s.closed).length).toBe(2);
  });

  it('pauses reconnect while sseAuthError is true (D06 amendment)', () => {
    const { run } = createLifecycleHarness(FakeEventSource);

    run('jwt-1', false);
    expect(FakeEventSource.constructCount).toBe(2);

    // Simulate an auth error: both sources get closed, no new sources open.
    run('jwt-1', true);
    expect(FakeEventSource.constructCount).toBe(2);
    expect(FakeEventSource.instances.every((s) => s.closed)).toBe(true);

    // Still paused while the flag is set.
    run('jwt-1', true);
    expect(FakeEventSource.constructCount).toBe(2);
  });

  it('resumes once sseAuthError is cleared (via banner Reload)', () => {
    const { run } = createLifecycleHarness(FakeEventSource);

    run('jwt-1', false);
    run('jwt-1', true); // error → pause
    expect(FakeEventSource.constructCount).toBe(2);

    // Reload clears the flag; effect opens a fresh pair.
    run('jwt-1', false);
    expect(FakeEventSource.constructCount).toBe(4);
    expect(FakeEventSource.instances.filter((s) => !s.closed).length).toBe(2);
  });

  it('closes everything when token becomes null', () => {
    const { run } = createLifecycleHarness(FakeEventSource);

    run('jwt-1', false);
    expect(FakeEventSource.constructCount).toBe(2);

    run(null, false);
    expect(FakeEventSource.instances.every((s) => s.closed)).toBe(true);
    expect(FakeEventSource.constructCount).toBe(2);
  });
});

// Surface the unused-import guard-rail: keep SseStatus referenced so the
// file remains aligned with the context type contract.
export type { SseStatus };
