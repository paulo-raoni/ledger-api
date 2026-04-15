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
    graphEvents,
    sseStatus,
    lastRunEvents,
    replayMode,
    startReplay,
  } = useApp();

  const isMobile = useIsMobile();

  // Post-M5 fix #1: the Graph/Terminal tab switcher is gone. Both panels
  // render simultaneously in a flex column; the Terminal pill/default/maximized
  // tri-state still governs whether the Terminal is collapsed to a pill or
  // taking up the default 200px slot below the Graph.
  const [terminalState, setTerminalState] = useState<TerminalState>('default');

  const showReplayTrigger = lastRunEvents.length > 0 && replayMode === 'LIVE';
  const showReplayBanner = replayMode === 'REPLAY';

  return (
    <div
      data-testid="mode-observability"
      className="observability-root"
    >
      {(showReplayTrigger || showReplayBanner) && (
        <div className="observability-toolbar">
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
      )}

      <div className="observability-graph">
        <GraphView
          events={graphEvents}
          sseStatus={sseStatus}
          currentUserSub={userId ?? ''}
        />
      </div>

      <TerminalView
        events={graphEvents}
        sseStatus={sseStatus}
        state={terminalState}
        onStateChange={setTerminalState}
        isMobile={isMobile}
        replayMode={replayMode}
      />
    </div>
  );
}
