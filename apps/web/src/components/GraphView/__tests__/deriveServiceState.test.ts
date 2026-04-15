/**
 * Unit tests for deriveServiceState.
 *
 * NOTE: apps/web has no JS test runner configured (only Playwright E2E).
 * This file is authored to be compatible with both vitest and jest so it
 * will run automatically once a runner is introduced in a future PR.
 * Until then, it is not executed by CI (`npm test` uses `--if-present` at
 * the workspace root and apps/web has no `test` script).
 */
import { describe, it, expect } from '@jest/globals';
import type { SseEvent } from '../../../types/sse';
import { deriveServiceState } from '../deriveServiceState';

const USER = 'user-1';
const OTHER = 'user-2';
const NOW = 1_700_000_000_000;

function req(
  service: 'identity' | 'ledger',
  opts: Partial<SseEvent> & { receivedAt?: number; userId?: string } = {},
): SseEvent {
  return {
    type: 'request',
    service,
    method: 'POST',
    path: '/users',
    userId: opts.userId ?? USER,
    timestamp: opts.receivedAt ?? NOW,
    receivedAt: opts.receivedAt ?? NOW,
    ...(opts as object),
  } as SseEvent;
}

describe('deriveServiceState', () => {
  it('returns idle with no events', () => {
    expect(deriveServiceState([], 'identity', USER, NOW)).toBe('idle');
  });

  it('returns active for a recent request event', () => {
    const ev = req('identity', { receivedAt: NOW - 500 });
    expect(deriveServiceState([ev], 'identity', USER, NOW)).toBe('active');
  });

  it('returns waiting for a recent db pg_advisory_xact_lock event', () => {
    const ev: SseEvent = {
      type: 'db',
      service: 'ledger',
      phase: 'start',
      operation: 'pg_advisory_xact_lock',
      table: 'balance_snapshots',
      userId: USER,
      timestamp: NOW - 200,
      receivedAt: NOW - 200,
    };
    expect(deriveServiceState([ev], 'ledger', USER, NOW)).toBe('waiting');
  });

  it('returns waiting for a recent SELECT FOR UPDATE db event (legacy operation name)', () => {
    const ev: SseEvent = {
      type: 'db',
      service: 'ledger',
      phase: 'start',
      operation: 'SELECT FOR UPDATE',
      table: 'balance_snapshots',
      userId: USER,
      timestamp: NOW - 200,
      receivedAt: NOW - 200,
    };
    expect(deriveServiceState([ev], 'ledger', USER, NOW)).toBe('waiting');
  });

  it('returns error for a recent error event', () => {
    const ev: SseEvent = {
      type: 'error',
      service: 'identity',
      status: 500,
      message: 'boom',
      userId: USER,
      timestamp: NOW - 100,
      receivedAt: NOW - 100,
    };
    expect(deriveServiceState([ev], 'identity', USER, NOW)).toBe('error');
  });

  it('returns idle for a recent response event', () => {
    const ev: SseEvent = {
      type: 'response',
      service: 'identity',
      status: 200,
      durationMs: 5,
      userId: USER,
      timestamp: NOW - 100,
      receivedAt: NOW - 100,
    };
    expect(deriveServiceState([ev], 'identity', USER, NOW)).toBe('idle');
  });

  it('decays to idle after 2000ms since receivedAt', () => {
    const ev = req('identity', { receivedAt: NOW - 2500 });
    expect(deriveServiceState([ev], 'identity', USER, NOW)).toBe('idle');
  });

  it('ignores events belonging to a different user', () => {
    const ev = req('identity', { userId: OTHER, receivedAt: NOW - 100 });
    expect(deriveServiceState([ev], 'identity', USER, NOW)).toBe('idle');
  });

  it('uses receivedAt, not backend timestamp, for decay', () => {
    // backend timestamp is 10s in the past, but the client just received it
    const ev: SseEvent = {
      type: 'request',
      service: 'identity',
      method: 'POST',
      path: '/users',
      userId: USER,
      timestamp: NOW - 10_000,
      receivedAt: NOW - 100,
    };
    expect(deriveServiceState([ev], 'identity', USER, NOW)).toBe('active');
  });
});
