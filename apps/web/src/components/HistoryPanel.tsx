import { useState } from 'react';
import { useApp, type HistoryEntry } from '../contexts/AppContext';
import { StatusBadge } from './StatusBadge';

function timeAgo(date: Date): string {
  const secs = Math.floor((Date.now() - date.getTime()) / 1000);
  if (secs < 60) return `${secs}s ago`;
  return `${Math.floor(secs / 60)}m ago`;
}

function HistoryEntryRow({ entry }: { entry: HistoryEntry }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div
      data-testid="history-entry"
      className="p-2 rounded cursor-pointer transition-colors"
      style={{ backgroundColor: 'var(--bg-base)', border: '1px solid var(--border)' }}
      onClick={() => setExpanded(!expanded)}
    >
      <div className="flex items-center gap-2 text-xs">
        <span className="font-mono font-semibold" style={{ color: 'var(--text-muted)' }}>{entry.method}</span>
        <span className="font-mono flex-1 truncate" style={{ color: 'var(--text-code)' }}>{entry.path}</span>
        <StatusBadge status={entry.status} />
        <span style={{ color: 'var(--text-muted)' }}>{entry.latencyMs}ms</span>
        <span style={{ color: 'var(--text-muted)' }}>{timeAgo(entry.timestamp)}</span>
      </div>
      {expanded && (
        <div className="mt-2 space-y-1">
          {entry.requestBody && (
            <pre className="text-xs p-1 rounded overflow-x-auto" style={{ color: 'var(--text-code)', backgroundColor: 'var(--bg-input)' }}>
              {JSON.stringify(entry.requestBody, null, 2)}
            </pre>
          )}
          <pre className="text-xs p-1 rounded overflow-x-auto" style={{ color: 'var(--text-code)', backgroundColor: 'var(--bg-input)' }}>
            {JSON.stringify(entry.responseBody, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

interface HistoryPanelProps {
  visible?: boolean;
}

export function HistoryPanel({ visible = true }: HistoryPanelProps) {
  const { history, clearHistory } = useApp();
  if (!visible) return null;
  return (
    <div
      data-testid="history-panel"
      className="flex flex-col h-full"
      style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '0.5rem' }}
    >
      <div className="flex items-center justify-between px-3 py-2" style={{ borderBottom: '1px solid var(--border)' }}>
        <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
          History
        </span>
        <button
          data-testid="history-clear"
          onClick={clearHistory}
          className="text-xs px-2 py-0.5 rounded"
          style={{ color: 'var(--text-muted)', border: '1px solid var(--border)' }}
        >
          Clear
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {history.length === 0 ? (
          <div className="text-xs text-center py-4" style={{ color: 'var(--text-muted)' }}>No requests yet</div>
        ) : (
          history.map((e) => <HistoryEntryRow key={e.id} entry={e} />)
        )}
      </div>
    </div>
  );
}
