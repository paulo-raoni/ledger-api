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
        <div className="section-label">
          {label}
        </div>
      )}
      <pre
        data-testid={testId}
        className="json-body p-2 rounded overflow-x-auto"
        style={{
          backgroundColor: 'var(--bg-input)',
          color: 'var(--text-code)',
          border: '1px solid var(--border)',
        }}
      >
        {text}
      </pre>
    </div>
  );
}
