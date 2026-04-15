export type DbState = 'idle' | 'active' | 'error';

interface DbBlockProps {
  service: 'identity' | 'ledger';
  state: DbState;
}

interface StateStyle {
  border: string;
  dotColor: string;
  animateDot: boolean;
}

function styleFor(state: DbState): StateStyle {
  switch (state) {
    case 'active':
      return {
        border: '1px solid var(--success)',
        dotColor: '#22c55e',
        animateDot: true,
      };
    case 'error':
      return {
        border: '1px solid var(--error)',
        dotColor: '#ef4444',
        animateDot: false,
      };
    case 'idle':
    default:
      return {
        border: '1px solid var(--border)',
        dotColor: '#94a3b8',
        animateDot: false,
      };
  }
}

export function DbBlock({ service, state }: DbBlockProps) {
  const s = styleFor(state);
  return (
    <div
      data-testid={`db-block-${service}`}
      style={{
        padding: '12px 16px',
        border: s.border,
        borderRadius: '8px',
        backgroundColor: 'var(--bg-card)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '6px',
        minWidth: '160px',
      }}
    >
      <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
        {service}-db
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <span
          className={s.animateDot ? 'dot-active' : ''}
          style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            backgroundColor: s.dotColor,
            display: 'inline-block',
          }}
        />
        <span
          style={{
            fontSize: '12px',
            color: 'var(--text-muted)',
            fontFamily: 'ui-monospace, monospace',
          }}
        >
          {state}
        </span>
      </div>
    </div>
  );
}
