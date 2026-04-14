import { useApp } from '../contexts/AppContext';

export function ThemeToggle() {
  const { theme, setTheme } = useApp();
  return (
    <button
      data-testid="theme-toggle"
      onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
      className="p-1.5 rounded-md text-sm transition-colors"
      style={{
        color: 'var(--text-muted)',
        border: '1px solid var(--border)',
        backgroundColor: 'var(--bg-card)',
      }}
      aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
    >
      {theme === 'dark' ? '☀' : '🌙'}
    </button>
  );
}
