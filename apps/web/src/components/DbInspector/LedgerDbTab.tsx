import { DbTable } from './DbTable';
import { formatAmount } from '../../lib/format';

interface LedgerDbTabProps {
  transactions: Array<Record<string, unknown>>;
  balanceSnapshots: Array<Record<string, unknown>>;
  idempotencyKeys: Array<Record<string, unknown>>;
  highlightIds?: Set<string>;
}

function formatCents(cents: unknown): string {
  const n = Number(cents);
  if (isNaN(n)) return String(cents);
  return `${formatAmount(n)} (${n} cents)`;
}

function timeOnly(ts: unknown): string {
  if (!ts) return '';
  try { return new Date(String(ts)).toLocaleTimeString(); } catch { return String(ts); }
}

export function LedgerDbTab({ transactions, balanceSnapshots, idempotencyKeys, highlightIds }: LedgerDbTabProps) {
  const formattedTxns = transactions.map((t) => ({
    ID: String(t['id'] ?? '').slice(0, 8) + '...',
    User: String(t['user_id'] ?? '').slice(0, 8) + '...',
    Type: String(t['type'] ?? ''),
    Amount: formatCents(t['amount']),
    'Created at': timeOnly(t['created_at']),
    id: String(t['id'] ?? ''),
  }));

  const formattedSnapshots = balanceSnapshots.map((s) => ({
    User: String(s['user_id'] ?? '').slice(0, 8) + '...',
    Balance: formatCents(s['amount']),
    'Last updated': timeOnly(s['updated_at']),
    id: String(s['user_id'] ?? ''),
  }));

  const formattedKeys = idempotencyKeys.map((k) => {
    const status = k['response_status'];
    const body = k['response_body'];
    const preview = `${status} · ${JSON.stringify(body ?? {}).slice(0, 40)}`;
    return {
      Key: String(k['key'] ?? ''),
      User: String(k['user_id'] ?? '').slice(0, 8) + '...',
      'Cached result': preview,
      'Created at': timeOnly(k['created_at']),
      id: String(k['key'] ?? ''),
    };
  });

  return (
    <div className="space-y-6">
      <div>
        <div className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--text-muted)' }}>
          TRANSACTIONS ({transactions.length} record{transactions.length !== 1 ? 's' : ''})
        </div>
        <DbTable
          testId="db-table-transactions"
          emptyTestId="db-empty-transactions"
          columns={['ID', 'User', 'Type', 'Amount', 'Created at']}
          rows={formattedTxns}
          emptyMessage="No transactions yet."
          highlightIds={highlightIds}
        />
      </div>
      <div>
        <div className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--text-muted)' }}>
          BALANCE SNAPSHOT
        </div>
        <div className="text-xs mb-2 italic" style={{ color: 'var(--text-muted)' }}>
          One row per user. Always up to date. This is what makes GET /balance an instant O(1) read.
        </div>
        <DbTable
          testId="db-table-balance"
          emptyTestId="db-empty-balance"
          columns={['User', 'Balance', 'Last updated']}
          rows={formattedSnapshots}
          emptyMessage="No balance snapshots yet."
          highlightIds={highlightIds}
        />
      </div>
      <div>
        <div className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--text-muted)' }}>
          IDEMPOTENCY CACHE
        </div>
        <div className="text-xs mb-2 italic" style={{ color: 'var(--text-muted)' }}>
          Every request sent with an Idempotency-Key is stored here. Duplicate requests return the cached result below — no double processing occurs.
        </div>
        <DbTable
          testId="db-table-idempotency"
          emptyTestId="db-empty-idempotency"
          columns={['Key', 'User', 'Cached result', 'Created at']}
          rows={formattedKeys}
          emptyMessage="No idempotency keys yet."
          highlightIds={highlightIds}
        />
      </div>
    </div>
  );
}
