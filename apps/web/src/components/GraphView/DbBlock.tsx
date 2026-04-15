export type DbState = 'idle' | 'active' | 'error';

interface DbBlockProps {
  service: 'identity' | 'ledger';
  state: DbState;
  /** PR 4 §4.3: expand-on-packet-arrival visual state. */
  expanded?: boolean;
  /** Formatted balance, e.g. "$100.00" (pre-formatted via formatAmount). */
  balance?: string | null;
  /** Delta cents; sign drives color (+green / -red). */
  deltaCents?: number | null;
  /** Pre-formatted delta string (signed), e.g. "+$30.00" / "-$30.00". */
  deltaFormatted?: string | null;
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

export function DbBlock({
  service,
  state,
  expanded,
  balance,
  deltaCents,
  deltaFormatted,
}: DbBlockProps) {
  const s = styleFor(state);
  const deltaClass =
    deltaCents === null || deltaCents === undefined
      ? ''
      : deltaCents >= 0
        ? 'db-delta-pos'
        : 'db-delta-neg';

  return (
    <div
      data-testid={`db-block-${service}`}
      className={expanded ? 'block-expanded' : ''}
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
        transition: 'border-color 200ms ease',
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
      <div className="block-body">
        <div className="block-body-inner" style={{ textAlign: 'center' }}>
          {balance ? (
            <div data-testid={`db-balance-${service}`} className="db-balance">
              balance: {balance}
            </div>
          ) : null}
          {deltaFormatted ? (
            <div data-testid={`db-delta-${service}`} className={deltaClass}>
              {deltaFormatted}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
