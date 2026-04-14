interface StatusBadgeProps {
  status: number;
  testId?: string;
}

export function StatusBadge({ status, testId }: StatusBadgeProps) {
  const isOk = status >= 200 && status < 300;
  const isExpected = status === 422 || status === 409;
  const color = isOk ? 'var(--success)' : isExpected ? 'var(--warning)' : 'var(--error)';
  return (
    <span
      data-testid={testId ?? 'step-status-badge'}
      className="inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-semibold"
      style={{ color, border: `1px solid ${color}`, backgroundColor: `${color}1a` }}
    >
      {status}
    </span>
  );
}
