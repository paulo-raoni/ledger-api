/**
 * Unit tests for the Terminal latency formatter (Fix 2e).
 *
 * NOTE: apps/web has no JS test runner wired to `npm test` yet (only
 * Playwright E2E is configured). This file is authored to run under
 * both jest and vitest when a runner is introduced later — mirroring
 * the convention established in deriveServiceState.test.ts.
 */
import { describe, it, expect } from '@jest/globals';
import { formatDuration } from '../LogLine';

describe('formatDuration', () => {
  it('rounds long floats to one decimal place', () => {
    expect(formatDuration(2.700016)).toBe('2.7ms');
  });

  it('preserves an existing single-decimal value', () => {
    expect(formatDuration(142.3)).toBe('142.3ms');
  });

  it('renders integer durations without a trailing decimal', () => {
    expect(formatDuration(1200)).toBe('1200ms');
  });

  it('rounds up at the 0.05ms boundary', () => {
    expect(formatDuration(0.25)).toBe('0.3ms');
  });

  it('formats zero as 0ms', () => {
    expect(formatDuration(0)).toBe('0ms');
  });
});
