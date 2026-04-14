import { DbTable } from './DbTable';

interface IdentityDbTabProps {
  users: Array<Record<string, unknown>>;
  highlightIds?: Set<string>;
}

function formatUser(u: Record<string, unknown>): Record<string, unknown> {
  const id = String(u['id'] ?? '');
  const createdAt = String(u['created_at'] ?? '');
  const timeOnly = createdAt ? new Date(createdAt).toLocaleTimeString() : '';
  return {
    ID: id.slice(0, 8) + '...',
    Name: `${u['first_name'] ?? ''} ${u['last_name'] ?? ''}`.trim(),
    Email: String(u['email'] ?? ''),
    'Created at': timeOnly,
  };
}

export function IdentityDbTab({ users, highlightIds }: IdentityDbTabProps) {
  const formatted = users.map(formatUser);
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
          USERS ({users.length} record{users.length !== 1 ? 's' : ''})
        </span>
      </div>
      <DbTable
        testId="db-table-users"
        emptyTestId="db-empty-users"
        columns={['ID', 'Name', 'Email', 'Created at']}
        rows={formatted}
        emptyMessage="No users yet. Run step 1 to create the first one."
        highlightIds={highlightIds}
      />
      <div className="mt-2 text-xs" style={{ color: 'var(--text-muted)' }}>
        ⚠ Password column hidden — stored as bcrypt hash
      </div>
    </div>
  );
}
