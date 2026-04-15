import { EventEmitter } from 'node:events';

export const eventBus = new EventEmitter();
// Avoid Node's default 10-listener warning under many concurrent SSE clients.
eventBus.setMaxListeners(1000);

/**
 * Emit an event on the in-memory bus.
 *
 * Attaches `timestamp` (epoch ms) and `service: 'ledger'` if not already set,
 * so every consumer receives a normalised envelope.
 */
export function emit(event) {
  const payload = { ...event };
  if (payload.timestamp == null) payload.timestamp = Date.now();
  if (payload.service == null) payload.service = 'ledger';
  eventBus.emit('event', payload);
  return payload;
}
