import { useApp, type Mode } from '../contexts/AppContext';

const modes: { id: Mode; label: string; color: string }[] = [
  { id: 'autoplay', label: 'Autoplay', color: 'var(--ledger)' },
  { id: 'guided', label: 'Guided', color: 'var(--identity)' },
  { id: 'playground', label: 'Playground', color: 'var(--warning)' },
];

export function ModeSelector() {
  const { mode, setMode } = useApp();
  return (
    <div className="flex gap-1">
      {modes.map((m) => {
        const active = mode === m.id;
        return (
          <button
            key={m.id}
            data-testid={`mode-${m.id}`}
            onClick={() => setMode(m.id)}
            className="px-3 py-1 text-sm rounded-md transition-colors relative"
            style={{
              color: active ? m.color : 'var(--text-muted)',
              backgroundColor: active ? `${m.color}1a` : 'transparent',
              borderBottom: active ? `2px solid ${m.color}` : '2px solid transparent',
            }}
          >
            {m.label}
          </button>
        );
      })}
    </div>
  );
}
