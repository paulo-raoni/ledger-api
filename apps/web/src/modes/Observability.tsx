import { useEffect, useRef, useState } from 'react';
import { useApp } from '../contexts/AppContext';
import type { SseEvent } from '../types/sse';
import { TerminalView } from '../components/TerminalView/TerminalView';
import { GraphView } from '../components/GraphView/GraphView';

type SseStatus = 'connected' | 'disconnected' | 'auth-error';

const MAX_EVENTS = 500;
const LEDGER_BASE = 'http://localhost:3001';
const IDENTITY_BASE = 'http://localhost:3002';

export function Observability() {
  const { token, userId, observabilityView, setObservabilityView } = useApp();

  const [events, setEvents] = useState<SseEvent[]>([]);
  const [sseStatus, setSseStatus] = useState<SseStatus>('disconnected');
  const sseStatusRef = useRef<SseStatus>('disconnected');

  const setStatus = (next: SseStatus) => {
    sseStatusRef.current = next;
    setSseStatus(next);
  };

  useEffect(() => {
    if (!token) {
      setStatus('disconnected');
      return;
    }

    const sources = [
      new EventSource(`${LEDGER_BASE}/events?token=${token}`),
      new EventSource(`${IDENTITY_BASE}/events?token=${token}`),
    ];

    sources.forEach((src) => {
      src.onopen = () => setStatus('connected');

      src.onerror = () => {
        if (sseStatusRef.current !== 'connected') {
          setStatus('auth-error');
        } else {
          setStatus('disconnected');
        }
      };

      src.onmessage = (e) => {
        try {
          const raw = JSON.parse(e.data) as Omit<SseEvent, 'receivedAt'>;
          const stamped = { ...raw, receivedAt: Date.now() } as SseEvent;
          setEvents((prev) =>
            prev.length >= MAX_EVENTS ? [...prev.slice(1), stamped] : [...prev, stamped],
          );
        } catch {
          // ignore malformed payloads
        }
      };
    });

    return () => {
      sources.forEach((s) => s.close());
    };
  }, [token]);

  return (
    <div data-testid="mode-observability" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <button
          data-testid="toggle-graph"
          onClick={() => setObservabilityView('graph')}
          className="px-3 py-1 text-sm rounded-md"
          style={{
            color: observabilityView === 'graph' ? 'var(--identity)' : 'var(--text-muted)',
            backgroundColor:
              observabilityView === 'graph' ? 'rgba(59,130,246,0.1)' : 'transparent',
            borderBottom:
              observabilityView === 'graph'
                ? '2px solid var(--identity)'
                : '2px solid transparent',
          }}
        >
          Graph
        </button>
        <button
          data-testid="toggle-terminal"
          onClick={() => setObservabilityView('terminal')}
          className="px-3 py-1 text-sm rounded-md"
          style={{
            color: observabilityView === 'terminal' ? 'var(--ledger)' : 'var(--text-muted)',
            backgroundColor:
              observabilityView === 'terminal' ? 'rgba(16,185,129,0.1)' : 'transparent',
            borderBottom:
              observabilityView === 'terminal'
                ? '2px solid var(--ledger)'
                : '2px solid transparent',
          }}
        >
          Terminal
        </button>
        <div style={{ flex: 1 }} />
      </div>

      {sseStatus === 'auth-error' && (
        <div
          data-testid="sse-auth-error"
          style={{
            padding: '8px 12px',
            border: '1px solid var(--error)',
            borderRadius: '6px',
            color: 'var(--error)',
            backgroundColor: 'rgba(239,68,68,0.08)',
            fontSize: '13px',
          }}
        >
          Authentication failed — please sign in again
        </div>
      )}

      {observabilityView === 'terminal' ? (
        <TerminalView events={events} sseStatus={sseStatus} />
      ) : (
        <GraphView
          events={events}
          sseStatus={sseStatus}
          currentUserSub={userId ?? ''}
        />
      )}
    </div>
  );
}
