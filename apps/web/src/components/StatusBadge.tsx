interface StatusBadgeProps {
  status: number;
  testId?: string;
}

export function StatusBadge({ status, testId }: StatusBadgeProps) {
  const isOk = status >= 200 && status < 300;
  const is4xx = status >= 400 && status < 500;
  const is5xx = status >= 500;
  const colorClass = isOk ? 'badge-status-success' : is4xx ? 'badge-status-warning' : is5xx ? 'badge-status-error' : 'badge-status-warning';
  return (
    <span
      data-testid={testId ?? 'step-status-badge'}
      className={`badge-status inline-flex items-center px-2 py-0.5 rounded font-mono font-semibold border ${colorClass}`}
    >
      {status}
    </span>
  );
}
