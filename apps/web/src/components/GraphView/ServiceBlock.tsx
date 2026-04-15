import type { ServiceState } from './deriveServiceState';

interface ServiceBlockProps {
  service: 'identity' | 'ledger';
  port: number;
  state: ServiceState;
}

interface StateStyle {
  border: string;
  dotColor: string;
  label: string | null;
  animateDot: boolean;
}

function styleFor(state: ServiceState): StateStyle {
  switch (state) {
    case 'active':
      return {
        border: '1px solid var(--success)',
        dotColor: '#22c55e',
        label: 'active',
        animateDot: true,
      };
    case 'waiting':
      return {
        border: '1px solid var(--warning)',
        dotColor: '#f59e0b',
        label: 'waiting',
        animateDot: false,
      };
    case 'error':
      return {
        border: '1px solid var(--error)',
        dotColor: '#ef4444',
        label: 'error',
        animateDot: false,
      };
    case 'idle':
    default:
      return {
        border: '1px solid var(--border)',
        dotColor: '#94a3b8',
        label: null,
        animateDot: false,
      };
  }
}

export function ServiceBlock({ service, port, state }: ServiceBlockProps) {
  const s = styleFor(state);

  return (
    <div
      data-testid={`service-block-${service}`}
      style={{
        padding: '16px 20px',
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
      <div
        style={{
          fontWeight: 600,
          color: 'var(--text-primary)',
          textTransform: 'capitalize',
        }}
      >
        {service}
      </div>
      <div
        style={{
          fontSize: '12px',
          color: 'var(--text-muted)',
          fontFamily: 'ui-monospace, monospace',
        }}
      >
        port {port}
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
          data-testid={`service-state-${service}`}
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
