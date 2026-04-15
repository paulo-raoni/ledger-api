import { useState, useEffect } from 'react';
import { fetchBothDbs, resetDb, type IdentityDb, type LedgerDb } from '../../api/debug';
import { useApp } from '../../contexts/AppContext';
import { IdentityDbTab } from './IdentityDbTab';
import { LedgerDbTab } from './LedgerDbTab';
import { Spinner } from '../Spinner';

type DbTab = 'identity' | 'ledger';

interface DbInspectorProps {
  onClose: () => void;
}

function timeSince(date: Date | null): string {
  if (!date) return '';
  const secs = Math.floor((Date.now() - date.getTime()) / 1000);
  if (secs < 2) return 'just now';
  return `${secs}s ago`;
}

export function DbInspector({ onClose }: DbInspectorProps) {
  const { dbSnapshot, setDbSnapshot } = useApp();
  const [tab, setTab] = useState<DbTab>('identity');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [highlightIds, setHighlightIds] = useState<Set<string>>(new Set());
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [resetFeedback, setResetFeedback] = useState<{ ok: boolean; message: string } | null>(null);

  const fetchData = async () => {
    setLoading(true);
    setError(false);
    try {
      const result = await fetchBothDbs();
      const prevIds = new Set<string>();
      // Collect prev IDs for highlight comparison
      if (dbSnapshot.ledger) {
        for (const t of dbSnapshot.ledger.transactions) prevIds.add(String(t['id'] ?? ''));
        for (const k of dbSnapshot.ledger.idempotency_keys) prevIds.add(String(k['key'] ?? ''));
      }
      if (dbSnapshot.identity) {
        for (const u of dbSnapshot.identity.users) prevIds.add(String(u['id'] ?? ''));
      }
      const newIds = new Set<string>();
      for (const t of result.ledger.transactions) {
        const id = String(t['id'] ?? '');
        if (!prevIds.has(id)) newIds.add(id);
      }
      for (const u of result.identity.users) {
        const id = String(u['id'] ?? '');
        if (!prevIds.has(id)) newIds.add(id);
      }
      setHighlightIds(newIds);
      setTimeout(() => setHighlightIds(new Set()), 3100);
      setDbSnapshot({ identity: result.identity, ledger: result.ledger, fetchedAt: new Date() });
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async () => {
    setResetting(true);
    setResetFeedback(null);
    try {
      await Promise.all([resetDb('identity'), resetDb('ledger')]);
      setShowResetModal(false);
      setResetFeedback({ ok: true, message: 'All tables truncated.' });
      await fetchData();
    } catch (err) {
      setResetFeedback({ ok: false, message: err instanceof Error ? err.message : 'Reset failed.' });
    } finally {
      setResetting(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const identityData: IdentityDb = dbSnapshot.identity ?? { users: [] };
  const ledgerData: LedgerDb = dbSnapshot.ledger ?? { transactions: [], balance_snapshots: [], idempotency_keys: [] };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-8"
      style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        data-testid="db-inspector"
        className="w-full max-w-3xl flex flex-col rounded-xl"
        style={{
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border)',
          maxHeight: '75vh',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
          <div className="flex items-center gap-3">
            <span className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>
              🗄 Database State
            </span>
            {dbSnapshot.fetchedAt && (
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                Fetched {timeSince(dbSnapshot.fetchedAt)}
              </span>
            )}
            <button
              data-testid="db-refresh"
              onClick={fetchData}
              disabled={loading}
              className="text-xs px-2 py-0.5 rounded flex items-center gap-1"
              style={{ color: 'var(--text-muted)', border: '1px solid var(--border)' }}
            >
              {loading ? <Spinner /> : '↻'} Refresh
            </button>
            <button
              data-testid="reset-db-button"
              onClick={() => { setResetFeedback(null); setShowResetModal(true); }}
              className="text-xs px-2 py-0.5 rounded"
              style={{ color: 'var(--error)', border: '1px solid var(--error)' }}
            >
              ⚠ Reset DB
            </button>
          </div>
          <button
            data-testid="db-close"
            onClick={onClose}
            className="text-xs px-2 py-1 rounded"
            style={{ color: 'var(--text-muted)', border: '1px solid var(--border)' }}
          >
            ✕ Close
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-4 py-2" style={{ borderBottom: '1px solid var(--border)' }}>
          {(['identity', 'ledger'] as DbTab[]).map((t) => (
            <button
              key={t}
              data-testid={`db-tab-${t}`}
              onClick={() => setTab(t)}
              className="px-3 py-1 text-xs rounded-md"
              style={{
                backgroundColor: tab === t ? 'var(--border-active)' : 'transparent',
                color: tab === t ? 'var(--text-primary)' : 'var(--text-muted)',
              }}
            >
              {t === 'identity' ? 'Identity DB' : 'Ledger DB'}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className={`flex-1 overflow-y-auto p-4 ${loading ? 'db-loading' : ''}`}>
          {resetFeedback && (
            <div
              className="mb-3 text-xs px-3 py-2 rounded"
              style={{
                backgroundColor: resetFeedback.ok ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
                border: `1px solid ${resetFeedback.ok ? 'var(--success)' : 'var(--error)'}`,
                color: resetFeedback.ok ? 'var(--success)' : 'var(--error)',
              }}
            >
              {resetFeedback.ok ? '✓' : '⚠'} {resetFeedback.message}
            </div>
          )}
          {error ? (
            <div data-testid="db-error" className="p-4 rounded" style={{ backgroundColor: 'rgba(239,68,68,0.1)', border: '1px solid var(--error)' }}>
              <div className="font-semibold text-sm mb-1" style={{ color: 'var(--error)' }}>
                ⚠ DB Inspector unavailable
              </div>
              <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                The /debug/db endpoint is not responding. Make sure the services are running with NODE_ENV=development.
              </div>
            </div>
          ) : tab === 'identity' ? (
            <IdentityDbTab users={identityData.users} highlightIds={highlightIds} />
          ) : (
            <LedgerDbTab
              transactions={ledgerData.transactions}
              balanceSnapshots={ledgerData.balance_snapshots}
              idempotencyKeys={ledgerData.idempotency_keys}
              highlightIds={highlightIds}
            />
          )}
        </div>
      </div>

      {/* Reset DB modal */}
      {showResetModal && (
        <div
          data-testid="reset-db-modal"
          className="fixed inset-0 z-60 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.7)' }}
        >
          <div
            className="w-full max-w-md rounded-xl p-6"
            style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)' }}
          >
            <div className="font-semibold text-base mb-4" style={{ color: 'var(--text-primary)' }}>
              ⚠ Reset Database
            </div>
            <p className="text-sm mb-3" style={{ color: 'var(--text-muted)' }}>This will run:</p>
            <pre
              className="text-xs rounded p-3 mb-4"
              style={{
                backgroundColor: 'var(--bg-card-hover)',
                border: '1px solid var(--border)',
                color: 'var(--text-primary)',
                fontFamily: "'JetBrains Mono', monospace",
                whiteSpace: 'pre-wrap',
              }}
            >{`TRUNCATE users CASCADE;              (identity DB)
TRUNCATE transactions,
         balance_snapshots,
         idempotency_keys CASCADE;   (ledger DB)`}</pre>
            <p className="text-xs mb-6" style={{ color: 'var(--error)' }}>This cannot be undone.</p>
            <div className="flex justify-end gap-3">
              <button
                data-testid="reset-db-cancel"
                onClick={() => setShowResetModal(false)}
                disabled={resetting}
                className="text-sm px-4 py-1.5 rounded"
                style={{ color: 'var(--text-muted)', border: '1px solid var(--border)' }}
              >
                Cancel
              </button>
              <button
                data-testid="reset-db-confirm"
                onClick={handleReset}
                disabled={resetting}
                className="text-sm px-4 py-1.5 rounded flex items-center gap-1"
                style={{ backgroundColor: 'var(--error)', color: '#fff', border: 'none' }}
              >
                {resetting ? <Spinner /> : null} Confirm Reset
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
