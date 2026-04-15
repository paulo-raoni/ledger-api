import { useApp } from './contexts/AppContext';
import { Header } from './components/Header';
import { Autoplay } from './modes/Autoplay';
import { Guided } from './modes/Guided';
import { Playground } from './modes/Playground';
import { Observability } from './modes/Observability';

export function App() {
  const { mode } = useApp();

  return (
    <div className="min-h-screen theme-transition" style={{ backgroundColor: 'var(--bg-base)' }}>
      <Header />
      <main className="max-w-5xl mx-auto px-4 py-4">
        {mode === 'autoplay' && <Autoplay />}
        {mode === 'guided' && <Guided />}
        {mode === 'playground' && <Playground />}
        {mode === 'observability' && <Observability />}
      </main>
    </div>
  );
}
