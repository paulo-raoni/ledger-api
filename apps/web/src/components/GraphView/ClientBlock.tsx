/**
 * ClientBlock — PR 4 §4.1.
 *
 * Top-left node of the Graph representing the browser client that originates
 * requests. Styled similar to ServiceBlock but without port / state dot.
 */
export function ClientBlock() {
  return (
    <div data-testid="client-block" className="client-block">
      <div
        style={{
          fontWeight: 600,
          color: 'var(--text-primary)',
        }}
      >
        Client
      </div>
      <div
        style={{
          fontSize: '12px',
          color: 'var(--text-muted)',
          fontFamily: 'ui-monospace, monospace',
        }}
      >
        browser
      </div>
    </div>
  );
}
