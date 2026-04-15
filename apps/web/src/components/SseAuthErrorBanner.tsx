import { useApp } from '../contexts/AppContext';

/**
 * Global banner rendered above mode tabs when SSE auth fails.
 *
 * PR 2 Fix 2c: the `sse-auth-error` testid (an M4 contract) moves here
 * from Observability.tsx. The banner is the user-visible signal that
 * both EventSources have been closed and will stay closed until the
 * page is refreshed (D06 amendment — opt-out of auto-reconnect).
 */
export function SseAuthErrorBanner() {
  const { sseAuthError } = useApp();
  if (!sseAuthError) return null;

  return (
    <div
      data-testid="sse-auth-error"
      role="alert"
      style={{
        padding: '8px 12px',
        margin: '8px auto',
        maxWidth: '64rem',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        border: '1px solid var(--error)',
        borderRadius: '6px',
        color: 'var(--error)',
        backgroundColor: 'rgba(239,68,68,0.08)',
        fontSize: '13px',
      }}
    >
      <span style={{ flex: 1 }}>
        Authentication failed — please refresh to reconnect.
      </span>
      <button
        data-testid="sse-auth-error-reload"
        type="button"
        onClick={() => window.location.reload()}
        style={{
          padding: '4px 10px',
          borderRadius: '4px',
          border: '1px solid var(--error)',
          backgroundColor: 'transparent',
          color: 'var(--error)',
          fontSize: '12px',
          fontWeight: 600,
          cursor: 'pointer',
        }}
      >
        Reload
      </button>
    </div>
  );
}
