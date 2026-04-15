import { useEffect, useRef, useState } from 'react';
import type { SseEvent } from '../../types/sse';
import { LogLine } from './LogLine';

export type TerminalState = 'pill' | 'default' | 'maximized';

interface TerminalViewProps {
  events: SseEvent[];
  sseStatus: 'connected' | 'disconnected' | 'auth-error';
  state: TerminalState;
  onStateChange: (next: TerminalState) => void;
  isMobile: boolean;
  /** Post-M5 fix #4: when REPLAY, render an amber banner atop the content. */
  replayMode?: 'LIVE' | 'REPLAY';
}

const REQ_COLORS = [
  'var(--req-color-1)',
  'var(--req-color-2)',
  'var(--req-color-3)',
  'var(--req-color-4)',
];

export function TerminalView({
  events,
  sseStatus,
  state,
  onStateChange,
  isMobile,
  replayMode = 'LIVE',
}: TerminalViewProps) {
  const [paused, setPaused] = useState(false);
  const [unread, setUnread] = useState(0);
  const [pulse, setPulse] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // requestId → color mapping (stable across renders; Map in a ref).
  const requestColorRef = useRef<Map<string, string>>(new Map());
  const nextColorIdxRef = useRef(0);

  // Glow-on-new-event: single timeout id stored in a ref; cleared on unmount
  // and before setting a new one (Pre-mortem 2 pattern, per PR 4).
  const [glow, setGlow] = useState(false);
  const glowTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Pulse-on-new-event for the pill dot; single timeout ref, same pattern.
  const pulseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Track the last-seen event count so we only react to new arrivals.
  const seenCountRef = useRef(events.length);

  useEffect(() => {
    if (events.length <= seenCountRef.current) {
      seenCountRef.current = events.length;
      return;
    }
    const newOnes = events.slice(seenCountRef.current);
    seenCountRef.current = events.length;

    // Assign a color to any new requestIds.
    for (const e of newOnes) {
      const rid = e.requestId;
      if (!rid) continue;
      if (!requestColorRef.current.has(rid)) {
        const color = REQ_COLORS[nextColorIdxRef.current % REQ_COLORS.length];
        requestColorRef.current.set(rid, color);
        nextColorIdxRef.current += 1;
      }
    }

    if (state === 'pill') {
      setUnread((n) => n + newOnes.length);
      if (pulseTimeoutRef.current) clearTimeout(pulseTimeoutRef.current);
      setPulse(true);
      pulseTimeoutRef.current = setTimeout(() => {
        setPulse(false);
        pulseTimeoutRef.current = null;
      }, 600);
    } else {
      // Glow border for 200ms. Clear any in-flight timeout first.
      if (glowTimeoutRef.current) clearTimeout(glowTimeoutRef.current);
      setGlow(true);
      glowTimeoutRef.current = setTimeout(() => {
        setGlow(false);
        glowTimeoutRef.current = null;
      }, 200);
    }
  }, [events, state]);

  // Clear timeouts on unmount to prevent dangling state updates.
  useEffect(() => {
    return () => {
      if (glowTimeoutRef.current) clearTimeout(glowTimeoutRef.current);
      if (pulseTimeoutRef.current) clearTimeout(pulseTimeoutRef.current);
    };
  }, []);

  // Auto-scroll on new events unless paused.
  useEffect(() => {
    if (paused) return;
    if (state === 'pill') return;
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [events, paused, state]);

  const openFromPill = () => {
    setUnread(0);
    setPulse(false);
    onStateChange('default');
  };

  const minimize = () => {
    setUnread(0);
    onStateChange('pill');
  };

  const toggleMaximize = () => {
    onStateChange(state === 'maximized' ? 'default' : 'maximized');
  };

  if (state === 'pill') {
    return (
      <button
        data-testid="terminal-pill"
        type="button"
        onClick={openFromPill}
        style={{
          position: 'absolute',
          bottom: '8px',
          left: '8px',
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: '12px',
          padding: '4px 12px',
          fontSize: '12px',
          color: 'var(--text-primary)',
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          fontFamily: 'ui-monospace, monospace',
          zIndex: 10,
        }}
      >
        <span>Terminal</span>
        <span style={{ color: 'var(--text-muted)' }}>·</span>
        <span data-testid="terminal-pill-count">{unread}</span>
        <span
          aria-hidden
          className={pulse ? 'terminal-pill-pulse' : undefined}
          style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            backgroundColor: 'var(--success)',
            display: 'inline-block',
          }}
        />
      </button>
    );
  }

  const isMax = state === 'maximized';
  const containerHeight = isMax ? undefined : isMobile ? '160px' : '200px';
  const containerFlex = isMax ? 1 : undefined;
  const containerTestId = isMax ? 'terminal-maximized' : 'terminal-default';

  const statusColor =
    sseStatus === 'connected'
      ? 'var(--success)'
      : sseStatus === 'auth-error'
        ? 'var(--error)'
        : 'var(--text-muted)';

  return (
    <div
      data-testid={containerTestId}
      data-glow={glow ? 'true' : undefined}
      className="terminal-container"
      style={{
        backgroundColor: '#0b1020',
        color: '#e2e8f0',
        borderRadius: '8px',
        border: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        height: containerHeight,
        flex: containerFlex,
        minHeight: 0,
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 12px',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          backgroundColor: '#0b1020',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: statusColor,
              display: 'inline-block',
            }}
          />
          <span
            data-testid="sse-status"
            style={{ color: '#cbd5e1', fontSize: '12px', fontFamily: 'ui-monospace, monospace' }}
          >
            {sseStatus}
          </span>
          <span style={{ color: '#cbd5e1', fontSize: '12px', marginLeft: '8px' }}>Terminal</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <button
            data-testid="terminal-pause"
            onClick={() => setPaused((p) => !p)}
            style={{
              padding: '4px 10px',
              fontSize: '12px',
              borderRadius: '4px',
              border: '1px solid rgba(255,255,255,0.15)',
              backgroundColor: 'transparent',
              color: '#cbd5e1',
              cursor: 'pointer',
            }}
          >
            {paused ? 'Resume scroll' : 'Pause scroll'}
          </button>
          <button
            data-testid="terminal-minimize"
            aria-label="Minimize terminal"
            onClick={minimize}
            style={headerIconButtonStyle}
          >
            —
          </button>
          <button
            data-testid="terminal-maximize"
            aria-label={isMax ? 'Restore terminal' : 'Maximize terminal'}
            onClick={toggleMaximize}
            style={headerIconButtonStyle}
          >
            □
          </button>
          <button
            data-testid="terminal-close"
            aria-label="Close terminal"
            onClick={minimize}
            style={headerIconButtonStyle}
          >
            ×
          </button>
        </div>
      </div>
      <div
        data-testid="terminal-view"
        ref={scrollRef}
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '8px 12px',
          backgroundColor: '#0b1020',
        }}
      >
        {replayMode === 'REPLAY' && (
          <div data-testid="terminal-replay-banner" className="terminal-replay-banner">
            ▶ REPLAYING — last Autoplay run
          </div>
        )}
        {events.map((event, i) => (
          <LogLine
            key={`${event.receivedAt}-${i}`}
            event={event}
            requestColor={
              event.requestId ? requestColorRef.current.get(event.requestId) : undefined
            }
          />
        ))}
      </div>
    </div>
  );
}

const headerIconButtonStyle: React.CSSProperties = {
  width: '24px',
  height: '24px',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: '14px',
  lineHeight: 1,
  borderRadius: '4px',
  border: '1px solid rgba(255,255,255,0.15)',
  backgroundColor: 'transparent',
  color: '#cbd5e1',
  cursor: 'pointer',
  padding: 0,
};
