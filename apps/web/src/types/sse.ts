export type SseEvent =
  | {
      type: 'request';
      service: string;
      method: string;
      path: string;
      userId: string;
      timestamp: number;
      receivedAt: number;
    }
  | {
      type: 'response';
      service: string;
      status: number;
      durationMs: number;
      userId: string;
      timestamp: number;
      receivedAt: number;
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
    }
  | {
      type: 'idempotency_check';
      service: string;
      key: string;
      hit: boolean;
      userId: string;
      timestamp: number;
      receivedAt: number;
    };
