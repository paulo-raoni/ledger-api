import type { SseEvent } from '../../types/sse';
import { formatDuration } from '../../lib/format';

interface LogLineProps {
  event: SseEvent;
  /** Color assigned to this event's requestId; undefined → no color, no prefix. */
  requestColor?: string;
}

// Re-export for tests / callers that imported from this module historically.
export { formatDuration };

function formatTimestamp(ts: number): string {
  const d = new Date(ts);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  const ms = String(d.getMilliseconds()).padStart(3, '0');
  return `${hh}:${mm}:${ss}.${ms}`;
}

interface LineStyle {
  color: string;
  icon: string;
  text: string;
  opacity?: number;
}

function computeStyle(event: SseEvent): LineStyle {
  switch (event.type) {
    case 'request':
      return {
        color: 'var(--text-muted)',
        icon: '',
        text: `${event.method} ${event.path}`,
      };
    case 'db':
      if (event.phase === 'start') {
        return {
          color: 'var(--identity)',
          icon: '→',
          text: `${event.operation} ${event.table}`,
        };
      }
      return {
        color: 'var(--identity)',
        icon: '→',
        text:
          event.durationMs !== undefined
            ? `${event.operation} (${formatDuration(event.durationMs)})`
            : `${event.operation}`,
        opacity: 0.7,
      };
    case 'idempotency_check':
      if (event.hit) {
        return {
          color: 'var(--warning)',
          icon: '⚠',
          text: `idempotency key ${event.key} HIT`,
        };
      }
      return {
        color: 'var(--text-muted)',
        icon: '',
        text: `idempotency key ${event.key} miss`,
      };
    case 'response': {
      const status = event.status;
      if (status >= 200 && status < 300) {
        return {
          color: 'var(--success)',
          icon: '✓',
          text: `${status} (${formatDuration(event.durationMs)})`,
        };
      }
      if (status >= 400 && status < 500) {
        return {
          color: 'var(--warning)',
          icon: '⚠',
          text: `${status} (${formatDuration(event.durationMs)})`,
        };
      }
      return {
        color: 'var(--error)',
        icon: '✗',
        text: `${status} (${formatDuration(event.durationMs)})`,
      };
    }
    case 'error':
      return {
        color: 'var(--error)',
        icon: '✗',
        text: `${event.status} ${event.message}`,
      };
    default:
      return { color: 'var(--text-muted)', icon: '', text: '' };
  }
}

export function LogLine({ event, requestColor }: LogLineProps) {
  const { color, icon, text, opacity } = computeStyle(event);
  const time = formatTimestamp(event.timestamp);
  const requestId = event.requestId;
  return (
    <div
      data-testid="terminal-line"
      style={{
        color,
        opacity,
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
        fontSize: '12px',
        lineHeight: '1.5',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
        padding: '1px 0',
      }}
    >
      <span style={{ color: 'var(--text-muted)' }}>[{time}]</span>
      {requestId ? (
        <>
          {' '}
          <span style={{ color: requestColor ?? 'var(--text-muted)' }}>[req-{requestId}]</span>
        </>
      ) : null}
      {icon ? ` ${icon} ` : ' '}
      {text}
    </div>
  );
}
