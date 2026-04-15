import { createContext, useContext, useEffect, useRef, useState, useCallback, type ReactNode } from 'react';
import type { SseEvent } from '../types/sse';

export type Mode = 'autoplay' | 'guided' | 'playground' | 'observability';
export type Theme = 'light' | 'dark';
export type ObservabilityView = 'graph' | 'terminal';
export type SseStatus = 'connected' | 'disconnected' | 'auth-error';
export type ReplayMode = 'LIVE' | 'REPLAY';
export type ReplaySpeed = 'slow' | 'medium' | 'fast';

const MAX_EVENTS = 500;
const LEDGER_BASE = 'http://localhost:3001';
const IDENTITY_BASE = 'http://localhost:3002';

/**
 * Replay speed → (between-event delay, packet animation duration) in ms.
 * Per m5-spec §4.4 + PR 4 criterion 9.
 */
export const REPLAY_TIMING: Record<ReplaySpeed, { stepMs: number; packetMs: number }> = {
  slow:   { stepMs: 3000, packetMs: 2000 },
  medium: { stepMs: 500,  packetMs: 400  },
  fast:   { stepMs: 200,  packetMs: 150  },
};

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
  observabilityView: ObservabilityView;
  events: SseEvent[];
  sseStatus: SseStatus;
  sseAuthError: boolean;
  // PR 4 §4.4
  lastRunEvents: SseEvent[];
  replayMode: ReplayMode;
  replaySpeed: ReplaySpeed;
  /** Events the Graph should render: live `events` in LIVE mode, or the
   *  progressively-replayed buffer in REPLAY mode. */
  graphEvents: SseEvent[];
  setToken: (token: string | null) => void;
  setUserId: (userId: string | null) => void;
  setTheme: (theme: Theme) => void;
  setMode: (mode: Mode) => void;
  addHistory: (entry: Omit<HistoryEntry, 'id'>) => void;
  clearHistory: () => void;
  setDbSnapshot: (snapshot: DbSnapshot) => void;
  setRunEmail: (email: string) => void;
  setObservabilityView: (view: ObservabilityView) => void;
  clearSseAuthError: () => void;
  // PR 4 §4.4
  setLastRunEvents: (events: SseEvent[]) => void;
  startReplay: (speed?: ReplaySpeed) => void;
  stopReplay: () => void;
  setReplaySpeed: (speed: ReplaySpeed) => void;
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
  const [observabilityView, setObservabilityViewState] = useState<ObservabilityView>(
    () => (window.innerWidth < 768 ? 'terminal' : 'graph'),
  );
  const [events, setEvents] = useState<SseEvent[]>([]);
  const [sseStatus, setSseStatusState] = useState<SseStatus>('disconnected');
  const [sseAuthError, setSseAuthError] = useState<boolean>(false);
  const sseStatusRef = useRef<SseStatus>('disconnected');

  // ── PR 4 §4.4 replay state ──────────────────────────────────────────
  const [lastRunEvents, setLastRunEventsState] = useState<SseEvent[]>([]);
  const [replayMode, setReplayMode] = useState<ReplayMode>('LIVE');
  const [replaySpeed, setReplaySpeedState] = useState<ReplaySpeed>('slow');
  const [replayBuffer, setReplayBuffer] = useState<SseEvent[]>([]);

  // Pre-mortem 4: store ALL replay timeout ids; clear on stop / speed change /
  // component unmount. No dangling timeouts.
  const replayTimeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const replayCursorRef = useRef(0);

  const clearReplayTimeouts = useCallback(() => {
    for (const t of replayTimeoutsRef.current) clearTimeout(t);
    replayTimeoutsRef.current = [];
  }, []);

  const setSseStatus = useCallback((next: SseStatus) => {
    sseStatusRef.current = next;
    setSseStatusState(next);
  }, []);

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

  const setObservabilityView = useCallback(
    (view: ObservabilityView) => setObservabilityViewState(view),
    [],
  );

  const clearSseAuthError = useCallback(() => setSseAuthError(false), []);

  const setLastRunEvents = useCallback((evs: SseEvent[]) => setLastRunEventsState(evs), []);

  // Kick off a cancellable setTimeout chain that feeds events into
  // `replayBuffer` one by one, spaced by REPLAY_TIMING[speed].stepMs.
  const scheduleReplay = useCallback(
    (source: SseEvent[], speed: ReplaySpeed, startAt: number) => {
      clearReplayTimeouts();
      const { stepMs } = REPLAY_TIMING[speed];
      for (let i = startAt; i < source.length; i++) {
        const delay = (i - startAt) * stepMs;
        const idx = i;
        const t = setTimeout(() => {
          replayCursorRef.current = idx + 1;
          setReplayBuffer((prev) => [...prev, source[idx]]);
          if (idx === source.length - 1) {
            // End of replay → back to LIVE.
            const tEnd = setTimeout(() => {
              setReplayMode('LIVE');
              setReplayBuffer([]);
              replayCursorRef.current = 0;
            }, stepMs);
            replayTimeoutsRef.current.push(tEnd);
          }
        }, delay);
        replayTimeoutsRef.current.push(t);
      }
    },
    [clearReplayTimeouts],
  );

  const startReplay = useCallback(
    (speed: ReplaySpeed = 'slow') => {
      if (lastRunEvents.length === 0) return;
      clearReplayTimeouts();
      setReplaySpeedState(speed);
      setReplayMode('REPLAY');
      setReplayBuffer([]);
      replayCursorRef.current = 0;
      scheduleReplay(lastRunEvents, speed, 0);
    },
    [lastRunEvents, scheduleReplay, clearReplayTimeouts],
  );

  const stopReplay = useCallback(() => {
    clearReplayTimeouts();
    setReplayMode('LIVE');
    setReplayBuffer([]);
    replayCursorRef.current = 0;
  }, [clearReplayTimeouts]);

  // Speed change while replaying: stop + restart from current cursor.
  const setReplaySpeed = useCallback(
    (speed: ReplaySpeed) => {
      setReplaySpeedState(speed);
      if (replayMode === 'REPLAY' && lastRunEvents.length > 0) {
        clearReplayTimeouts();
        const from = replayCursorRef.current;
        // Rebuild buffer up to the cursor so the graph keeps its existing
        // rendered events; subsequent events fire at the new cadence.
        setReplayBuffer(lastRunEvents.slice(0, from));
        scheduleReplay(lastRunEvents, speed, from);
      }
    },
    [replayMode, lastRunEvents, scheduleReplay, clearReplayTimeouts],
  );

  // Pre-mortem 4: ensure no dangling timeouts on unmount.
  useEffect(() => {
    return () => {
      clearReplayTimeouts();
    };
  }, [clearReplayTimeouts]);

  // Regenerate runEmail and reset shared history whenever the mode changes to avoid
  // email collisions across runs (Autoplay/Guided/Playground each start a fresh run).
  useEffect(() => {
    setRunEmailState(`alice+${Date.now()}@demo.com`);
    setHistory([]);
  }, [mode]);

  // SSE connection lifted from Observability (PR 2 Fix 2c). Open both
  // EventSources while token exists AND we are not in an auth-error pause
  // (D06 amendment: opt out of permanent reconnect loop once SSE is global).
  useEffect(() => {
    if (!token || sseAuthError) {
      setSseStatus('disconnected');
      return;
    }

    const sources = [
      new EventSource(`${LEDGER_BASE}/events?token=${token}`),
      new EventSource(`${IDENTITY_BASE}/events?token=${token}`),
    ];

    const closeAll = () => sources.forEach((s) => s.close());

    sources.forEach((src) => {
      src.onopen = () => setSseStatus('connected');

      src.onerror = () => {
        if (sseStatusRef.current !== 'connected') {
          setSseStatus('auth-error');
          setSseAuthError(true);
          closeAll();
        } else {
          setSseStatus('disconnected');
        }
      };

      src.onmessage = (e) => {
        try {
          const raw = JSON.parse(e.data) as Omit<SseEvent, 'receivedAt'>;
          const stamped = { ...raw, receivedAt: Date.now() } as SseEvent;
          setEvents((prev) =>
            prev.length >= MAX_EVENTS ? [...prev.slice(1), stamped] : [...prev, stamped],
          );
        } catch {
          // ignore malformed payloads
        }
      };
    });

    return () => {
      closeAll();
    };
  }, [token, sseAuthError, setSseStatus]);

  // Apply theme on mount
  if (theme === 'dark') {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }

  const graphEvents = replayMode === 'REPLAY' ? replayBuffer : events;

  return (
    <AppContext.Provider
      value={{
        token, userId, theme, mode, history, dbSnapshot, runEmail, observabilityView,
        events, sseStatus, sseAuthError,
        lastRunEvents, replayMode, replaySpeed, graphEvents,
        setToken, setUserId, setTheme, setMode,
        addHistory, clearHistory, setDbSnapshot, setRunEmail, setObservabilityView,
        clearSseAuthError,
        setLastRunEvents, startReplay, stopReplay, setReplaySpeed,
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
