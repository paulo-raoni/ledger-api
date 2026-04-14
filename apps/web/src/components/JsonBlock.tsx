interface JsonBlockProps {
  data: unknown;
  testId?: string;
  label?: string;
}

export function JsonBlock({ data, testId, label }: JsonBlockProps) {
  const text = data === undefined || data === null ? '' : JSON.stringify(data, null, 2);
  return (
    <div className="mt-1">
      {label && (
        <div className="text-xs uppercase tracking-wide mb-1" style={{ color: 'var(--text-muted)' }}>
          {label}
        </div>
      )}
      <pre
        data-testid={testId}
        className="text-xs p-2 rounded overflow-x-auto"
        style={{
          backgroundColor: 'var(--bg-input)',
          color: 'var(--text-code)',
          fontFamily: 'JetBrains Mono, Fira Code, monospace',
          border: '1px solid var(--border)',
        }}
      >
        {text}
      </pre>
    </div>
  );
}
