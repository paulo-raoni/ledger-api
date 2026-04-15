import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';

export type Mode = 'autoplay' | 'guided' | 'playground';
export type Theme = 'light' | 'dark';

export interface HistoryEntry {
  id: string;
  method: string;
  path: string;
  status: number;
  latencyMs: number;
  requestBody?: object;
  requestHeaders?: Record<string, string>;
  responseBody: unknown;
  timestamp: Date;
}

export interface DbSnapshot {
  identity: {
    users: Array<Record<string, unknown>>;
  } | null;
  ledger: {
    transactions: Array<Record<string, unknown>>;
    balance_snapshots: Array<Record<string, unknown>>;
    idempotency_keys: Array<Record<string, unknown>>;
  } | null;
  fetchedAt: Date | null;
}

interface AppState {
  token: string | null;
  userId: string | null;
  theme: Theme;
  mode: Mode;
  history: HistoryEntry[];
  dbSnapshot: DbSnapshot;
  runEmail: string;
  setToken: (token: string | null) => void;
  setUserId: (userId: string | null) => void;
  setTheme: (theme: Theme) => void;
  setMode: (mode: Mode) => void;
  addHistory: (entry: Omit<HistoryEntry, 'id'>) => void;
  clearHistory: () => void;
  setDbSnapshot: (snapshot: DbSnapshot) => void;
  setRunEmail: (email: string) => void;
}

const AppContext = createContext<AppState | null>(null);

function getInitialTheme(): Theme {
  const stored = localStorage.getItem('theme');
  if (stored === 'light' || stored === 'dark') return stored;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function generateRunEmail(): string {
  return `alice+${Date.now()}@demo.com`;
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [token, setTokenState] = useState<string | null>(null);
  const [userId, setUserIdState] = useState<string | null>(null);
  const [theme, setThemeState] = useState<Theme>(getInitialTheme);
  const [mode, setModeState] = useState<Mode>('autoplay');
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [dbSnapshot, setDbSnapshotState] = useState<DbSnapshot>({
    identity: null,
    ledger: null,
    fetchedAt: null,
  });
  const [runEmail, setRunEmailState] = useState<string>(generateRunEmail);

  const setToken = useCallback((t: string | null) => setTokenState(t), []);
  const setUserId = useCallback((id: string | null) => setUserIdState(id), []);

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t);
    localStorage.setItem('theme', t);
    if (t === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, []);

  const setMode = useCallback((m: Mode) => setModeState(m), []);

  const addHistory = useCallback((entry: Omit<HistoryEntry, 'id'>) => {
    const fullEntry: HistoryEntry = { ...entry, id: `${Date.now()}-${Math.random()}` };
    setHistory(prev => [fullEntry, ...prev].slice(0, 50));
  }, []);

  const clearHistory = useCallback(() => setHistory([]), []);

  const setDbSnapshot = useCallback((snapshot: DbSnapshot) => setDbSnapshotState(snapshot), []);

  const setRunEmail = useCallback((email: string) => setRunEmailState(email), []);

  // Regenerate runEmail and reset shared history whenever the mode changes to avoid
  // email collisions across runs (Autoplay/Guided/Playground each start a fresh run).
  useEffect(() => {
    setRunEmailState(`alice+${Date.now()}@demo.com`);
    setHistory([]);
  }, [mode]);

  // Apply theme on mount
  if (theme === 'dark') {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }

  return (
    <AppContext.Provider
      value={{
        token, userId, theme, mode, history, dbSnapshot, runEmail,
        setToken, setUserId, setTheme, setMode,
        addHistory, clearHistory, setDbSnapshot, setRunEmail,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp(): AppState {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}

export { generateRunEmail };
