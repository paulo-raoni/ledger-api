interface DbTableProps {
  testId: string;
  columns: string[];
  rows: Array<Record<string, unknown>>;
  emptyMessage?: string;
  emptyTestId?: string;
  highlightIds?: Set<string>;
}

export function DbTable({ testId, columns, rows, emptyMessage, emptyTestId, highlightIds }: DbTableProps) {
  if (rows.length === 0) {
    return (
      <div data-testid={testId}>
        <div
          data-testid={emptyTestId ?? `db-empty-${testId}`}
          className="text-xs py-4 text-center"
          style={{ color: 'var(--text-muted)', borderTop: '1px solid var(--border)' }}
        >
          {emptyMessage ?? 'No records yet.'}
        </div>
      </div>
    );
  }

  return (
    <div data-testid={testId} className="overflow-x-auto">
      <table className="w-full text-xs" style={{ borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--border)' }}>
            {columns.map((col) => (
              <th key={col} className="text-left px-2 py-1.5 font-semibold uppercase tracking-wide"
                style={{ color: 'var(--text-muted)' }}>
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            const id = String(row['id'] ?? row['key'] ?? row['user_id'] ?? i);
            const isNew = highlightIds?.has(id);
            return (
              <tr
                key={i}
                data-testid={isNew ? 'db-row-new' : 'db-row'}
                className={isNew ? 'row-new' : ''}
                style={{ borderBottom: '1px solid var(--border)' }}
              >
                {columns.map((col) => (
                  <td key={col} className="px-2 py-1.5" style={{ color: 'var(--text-primary)' }}>
                    {String(row[col] ?? '')}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
