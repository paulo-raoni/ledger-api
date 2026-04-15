import { useEffect, useState } from 'react';
import type { SseEvent } from '../../types/sse';
import { ServiceBlock } from './ServiceBlock';
import { DbBlock, type DbState } from './DbBlock';
import { Arrow } from './Arrow';
import { deriveServiceState, type ServiceState } from './deriveServiceState';

interface GraphViewProps {
  events: SseEvent[];
  sseStatus: 'connected' | 'disconnected' | 'auth-error';
  currentUserSub: string;
}

function deriveDbState(
  events: SseEvent[],
  service: 'identity' | 'ledger',
  currentUserSub: string,
  now: number,
): DbState {
  const mine = events.filter(
    (e) =>
      e.userId === currentUserSub && e.service === service && e.type === 'db',
  );
  const last = mine[mine.length - 1];
  if (!last) {
    // Check for error affecting this service
    const lastAny = events
      .filter((e) => e.userId === currentUserSub && e.service === service)
      .slice(-1)[0];
    if (lastAny && lastAny.type === 'error' && now - lastAny.receivedAt <= 2000) {
      return 'error';
    }
    return 'idle';
  }
  if (now - last.receivedAt > 2000) return 'idle';
  return 'active';
}

function serviceToDbActive(state: ServiceState): boolean {
  return state === 'active' || state === 'waiting';
}

export function GraphView({ events, sseStatus, currentUserSub }: GraphViewProps) {
  // Force re-render every 500ms so decay-to-idle happens without new events.
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 500);
    return () => clearInterval(id);
  }, []);

  const now = Date.now();
  const identityState = deriveServiceState(events, 'identity', currentUserSub, now);
  const ledgerState = deriveServiceState(events, 'ledger', currentUserSub, now);
  const identityDbState = deriveDbState(events, 'identity', currentUserSub, now);
  const ledgerDbState = deriveDbState(events, 'ledger', currentUserSub, now);

  // Identity→Ledger arrow: active while identity is producing a request or
  // ledger has just received one and neither has returned to idle.
  const crossArrowActive =
    serviceToDbActive(identityState) || serviceToDbActive(ledgerState);

  const statusColor =
    sseStatus === 'connected'
      ? 'var(--success)'
      : sseStatus === 'auth-error'
        ? 'var(--error)'
        : 'var(--text-muted)';

  return (
    <div
      data-testid="graph-view"
      style={{
        padding: '24px',
        border: '1px solid var(--border)',
        borderRadius: '8px',
        backgroundColor: 'var(--bg-card)',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}
      >
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
          style={{
            fontSize: '12px',
            color: 'var(--text-muted)',
            fontFamily: 'ui-monospace, monospace',
          }}
        >
          {sseStatus}
        </span>
      </div>

      <div className="graph-container">
        {/* Row 1: service blocks with horizontal arrow */}
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <ServiceBlock service="identity" port={3002} state={identityState} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <Arrow direction="right" active={crossArrowActive} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <ServiceBlock service="ledger" port={3001} state={ledgerState} />
        </div>

        {/* Row 2: vertical arrows to DBs */}
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <Arrow direction="down" active={serviceToDbActive(identityState)} />
        </div>
        <div />
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <Arrow direction="down" active={serviceToDbActive(ledgerState)} />
        </div>

        {/* Row 3: DB blocks */}
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <DbBlock service="identity" state={identityDbState} />
        </div>
        <div />
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <DbBlock service="ledger" state={ledgerDbState} />
        </div>
      </div>
    </div>
  );
}
