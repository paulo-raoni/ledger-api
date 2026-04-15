import { ModeSelector } from './ModeSelector';
import { ServiceHealthDot } from './ServiceHealthDot';
import { ThemeToggle } from './ThemeToggle';

export function Header() {
  return (
    <header
      className="sticky top-0 z-50 theme-transition"
      style={{
        backgroundColor: 'var(--bg-card)',
        borderBottom: '1px solid var(--border)',
      }}
    >
      <div className="app-header-row">
        <span
          data-testid="app-title"
          className="app-header-title whitespace-nowrap"
          style={{ color: 'var(--text-primary)' }}
        >
          ledger-api
        </span>
        <div className="app-header-health">
          <span className="app-header-health-item">
            <ServiceHealthDot service="identity" url="http://localhost:3002/health" />
            <span className="app-header-health-label" style={{ color: 'var(--text-muted)' }}>
              identity
            </span>
          </span>
          <span className="app-header-health-item">
            <ServiceHealthDot service="ledger" url="http://localhost:3001/health" />
            <span className="app-header-health-label" style={{ color: 'var(--text-muted)' }}>
              ledger
            </span>
          </span>
        </div>
        <div className="app-header-toggle">
          <ThemeToggle />
        </div>
      </div>
      <div className="app-header-tabs">
        <ModeSelector />
      </div>
    </header>
  );
}
