import { ModeSelector } from './ModeSelector';
import { ServiceHealthDot } from './ServiceHealthDot';
import { ThemeToggle } from './ThemeToggle';

export function Header() {
  return (
    <header
      className="sticky top-0 z-50 h-12 flex items-center px-4 gap-4 theme-transition"
      style={{
        backgroundColor: 'var(--bg-card)',
        borderBottom: '1px solid var(--border)',
      }}
    >
      <span className="font-semibold text-sm whitespace-nowrap" style={{ color: 'var(--text-primary)' }}>
        ledger-api
      </span>
      <div className="flex-1 flex justify-center">
        <ModeSelector />
      </div>
      <div className="flex items-center gap-2">
        <ServiceHealthDot service="identity" url="http://localhost:3002/health" />
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>identity</span>
        <ServiceHealthDot service="ledger" url="http://localhost:3001/health" />
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>ledger</span>
        <ThemeToggle />
      </div>
    </header>
  );
}
