interface ProgressBarProps {
  current: number;
  total: number;
  service?: 'identity' | 'ledger';
}

export function ProgressBar({ current, total, service }: ProgressBarProps) {
  const pct = Math.round((current / total) * 100);
  const color = service === 'identity' ? 'var(--identity)' : 'var(--ledger)';
  return (
    <div className="flex items-center gap-2">
      <div
        data-testid="progress-label"
        className="text-xs whitespace-nowrap"
        style={{ color: 'var(--text-muted)' }}
      >
        Step {current} of {total}
      </div>
      <div
        className="flex-1 rounded-full overflow-hidden h-1.5"
        style={{ backgroundColor: 'var(--border)' }}
      >
        <div
          data-testid="progress-bar"
          className="h-full rounded-full progress-bar"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
      <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
        {pct}%
      </div>
    </div>
  );
}
