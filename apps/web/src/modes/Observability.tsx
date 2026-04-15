import { useApp } from '../contexts/AppContext';
import { TerminalView } from '../components/TerminalView/TerminalView';
import { GraphView } from '../components/GraphView/GraphView';

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

  const showReplayTrigger = lastRunEvents.length > 0 && replayMode === 'LIVE';

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

      {observabilityView === 'terminal' ? (
        <TerminalView events={events} sseStatus={sseStatus} />
      ) : (
        <GraphView
          events={graphEvents}
          sseStatus={sseStatus}
          currentUserSub={userId ?? ''}
        />
      )}
    </div>
  );
}
