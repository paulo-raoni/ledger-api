import { useEffect, useRef, useState } from 'react';
import type { SseEvent } from '../../types/sse';
import { LogLine } from './LogLine';

interface TerminalViewProps {
  events: SseEvent[];
  sseStatus: 'connected' | 'disconnected' | 'auth-error';
}

export function TerminalView({ events, sseStatus }: TerminalViewProps) {
  const [paused, setPaused] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (paused) return;
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [events, paused]);

  const statusColor =
    sseStatus === 'connected'
      ? 'var(--success)'
      : sseStatus === 'auth-error'
        ? 'var(--error)'
        : 'var(--text-muted)';

  return (
    <div
      data-testid="terminal-view"
      style={{
        backgroundColor: '#0b1020',
        color: '#e2e8f0',
        borderRadius: '8px',
        border: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        height: 'calc(100vh - 180px)',
        minHeight: '320px',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 12px',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          backgroundColor: '#0b1020',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: statusColor,
              display: 'inline-block',
            }}
          />
          <span
            data-testid="sse-status"
            style={{ color: '#cbd5e1', fontSize: '12px', fontFamily: 'ui-monospace, monospace' }}
          >
            {sseStatus}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <button
            data-testid="terminal-pause"
            onClick={() => setPaused((p) => !p)}
            style={{
              padding: '4px 10px',
              fontSize: '12px',
              borderRadius: '4px',
              border: '1px solid rgba(255,255,255,0.15)',
              backgroundColor: 'transparent',
              color: '#cbd5e1',
              cursor: 'pointer',
            }}
          >
            {paused ? 'Resume scroll' : 'Pause scroll'}
          </button>
        </div>
      </div>
      <div
        ref={scrollRef}
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '8px 12px',
          backgroundColor: '#0b1020',
        }}
      >
        {events.map((event, i) => (
          <LogLine key={`${event.receivedAt}-${i}`} event={event} />
        ))}
      </div>
    </div>
  );
}
