import { useEffect, useState } from 'react';
import { useApp } from '../contexts/AppContext';
import { TerminalView, type TerminalState } from '../components/TerminalView/TerminalView';
import { GraphView } from '../components/GraphView/GraphView';

function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState<boolean>(
    () => window.matchMedia('(max-width: 767px)').matches,
  );
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  return isMobile;
}

export function Observability() {
  const {
    userId,
    observabilityView,
    setObservabilityView,
    events,
    graphEvents,
    sseStatus,
    lastRunEvents,
    replayMode,
    startReplay,
  } = useApp();

  const isMobile = useIsMobile();

  // PR 5: Terminal tri-state lives locally — it's a UI concern of the
  // Observability mode and Observability is the persistent container.
  // Initial state: Pill on desktop, Default on mobile (matches M4 default
  // where mobile users landed on Terminal).
  const [terminalState, setTerminalState] = useState<TerminalState>(
    isMobile ? 'default' : 'pill',
  );

  // Keep the M4 `toggle-graph` / `toggle-terminal` buttons working:
  //  - toggle-terminal → force Terminal to Default (mounts terminal-view).
  //  - toggle-graph    → minimize Terminal to Pill.
  // observabilityView is still persisted in AppContext for backward compat.
  useEffect(() => {
    if (observabilityView === 'terminal' && terminalState === 'pill') {
      setTerminalState('default');
    }
    if (observabilityView === 'graph' && terminalState !== 'pill' && !isMobile) {
      setTerminalState('pill');
    }
  }, [observabilityView, terminalState, isMobile]);

  const showReplayTrigger = lastRunEvents.length > 0 && replayMode === 'LIVE';

  const compressGraph = isMobile && terminalState !== 'pill';

  return (
    <div
      data-testid="mode-observability"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        position: 'relative',
        minHeight: 'calc(100vh - 180px)',
      }}
    >
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
        {showReplayTrigger && (
          <button
            data-testid="replay-trigger"
            onClick={() => startReplay('slow')}
            className="px-3 py-1 text-xs rounded-md"
            style={{
              color: 'var(--warning)',
              backgroundColor: 'color-mix(in srgb, var(--warning) 15%, transparent)',
              border: '1px solid var(--warning)',
              fontWeight: 600,
            }}
          >
            ▶ Replay in Graph
          </button>
        )}
      </div>

      <div className={compressGraph ? 'graph-compressed' : undefined}>
        <GraphView
          events={graphEvents}
          sseStatus={sseStatus}
          currentUserSub={userId ?? ''}
        />
      </div>

      <TerminalView
        events={events}
        sseStatus={sseStatus}
        state={terminalState}
        onStateChange={setTerminalState}
        isMobile={isMobile}
      />
    </div>
  );
}
