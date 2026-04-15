import type { SseEvent } from '../../types/sse';

export type ServiceState = 'idle' | 'active' | 'waiting' | 'error';

/**
 * Derive the visual state of a service block from the SSE event stream.
 *
 * Cross-user isolation: although the SSE bus already filters events server-side
 * by user (see PR 2), we also filter defensively by `userId === currentUserSub`
 * on the client as a second line of defense.
 *
 * Decay uses the CLIENT `receivedAt` timestamp (stamped on arrival) rather than
 * the backend `timestamp`, so the view returns to idle even if clocks differ.
 */
export function deriveServiceState(
  events: SseEvent[],
  service: 'identity' | 'ledger',
  currentUserSub: string,
  now: number = Date.now(),
): ServiceState {
  const mine = events.filter(
    (e) => e.userId === currentUserSub && e.service === service,
  );
  const last = mine[mine.length - 1];
  if (!last) return 'idle';

  const age = now - last.receivedAt;
  if (age > 2000) return 'idle';

  if (last.type === 'error') return 'error';
  if (
    last.type === 'db' &&
    (last.operation === 'pg_advisory_xact_lock' ||
      last.operation === 'SELECT FOR UPDATE')
  ) {
    return 'waiting';
  }
  if (
    last.type === 'request' ||
    last.type === 'db' ||
    last.type === 'idempotency_check'
  ) {
    return 'active';
  }
  if (last.type === 'response') return 'idle';
  return 'idle';
}
