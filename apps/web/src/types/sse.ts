/**
 * Backend emits a `requestId` on every envelope (M5 PR 1 Fix 1d —
 * 6 lowercase hex chars). Optional on the consumer side so that
 * pre-PR 1 cached or malformed payloads never crash the UI.
 */
export type SseEvent =
  | {
      type: 'request';
      service: string;
      method: string;
      path: string;
      userId: string;
      timestamp: number;
      receivedAt: number;
      requestId?: string;
    }
  | {
      type: 'response';
      service: string;
      status: number;
      durationMs: number;
      userId: string;
      timestamp: number;
      receivedAt: number;
      requestId?: string;
    }
  | {
      type: 'error';
      service: string;
      status: number;
      message: string;
      code?: string;
      userId: string;
      timestamp: number;
      receivedAt: number;
      requestId?: string;
    }
  | {
      type: 'db';
      service: string;
      phase: 'start' | 'end';
      operation: string;
      table: string;
      durationMs?: number;
      userId: string;
      timestamp: number;
      receivedAt: number;
      requestId?: string;
    }
  | {
      type: 'idempotency_check';
      service: string;
      key: string;
      hit: boolean;
      userId: string;
      timestamp: number;
      receivedAt: number;
      requestId?: string;
    };
