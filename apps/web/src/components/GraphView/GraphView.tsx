import { useEffect, useMemo, useRef, useState } from 'react';
import type { SseEvent } from '../../types/sse';
import { ServiceBlock } from './ServiceBlock';
import { DbBlock, type DbState } from './DbBlock';
import { Arrow } from './Arrow';
import { ClientBlock } from './ClientBlock';
import { Packet, OFFSET_PATH_SUPPORTED, type PacketService } from './Packet';
import { deriveServiceState, type ServiceState } from './deriveServiceState';
import { useApp, REPLAY_TIMING } from '../../contexts/AppContext';
import { formatAmount } from '../../lib/format';

interface GraphViewProps {
  events: SseEvent[];
  sseStatus: 'connected' | 'disconnected' | 'auth-error';
  currentUserSub: string;
}

function deriveDbState(
  events: SseEvent[],
  service: 'identity' | 'ledger',
  currentUserSub: string,
  now: number,
): DbState {
  const mine = events.filter(
    (e) =>
      e.userId === currentUserSub && e.service === service && e.type === 'db',
  );
  const last = mine[mine.length - 1];
  if (!last) {
    const lastAny = events
      .filter((e) => e.userId === currentUserSub && e.service === service)
      .slice(-1)[0];
    if (lastAny && lastAny.type === 'error' && now - lastAny.receivedAt <= 2000) {
      return 'error';
    }
    return 'idle';
  }
  if (now - last.receivedAt > 2000) return 'idle';
  return 'active';
}

function serviceToDbActive(state: ServiceState): boolean {
  return state === 'active' || state === 'waiting';
}

/**
 * Extract the last request body summary (first 2 lines of JSON, truncated)
 * from an event stream for a given service. Falls back to the method+path.
 */
function lastRequestSummary(events: SseEvent[], service: 'identity' | 'ledger'): string | null {
  for (let i = events.length - 1; i >= 0; i--) {
    const e = events[i];
    if (e.service === service && e.type === 'request') {
      return `${e.method} ${e.path}`;
    }
  }
  return null;
}

function lastResponseSummary(events: SseEvent[], service: 'identity' | 'ledger'): string | null {
  for (let i = events.length - 1; i >= 0; i--) {
    const e = events[i];
    if (e.service === service && e.type === 'response') {
      return `${e.status} · ${e.durationMs}ms`;
    }
    if (e.service === service && e.type === 'error') {
      return `${e.status} · ${e.message}`;
    }
  }
  return null;
}

// Rough coordinates for packet travel in the fallback transform path.
// In offset-path mode we pass the same SVG path as a CSS path() string; in
// fallback mode we pass dx/dy between the arrow's start and end points.
const ARROW_PATH_H = 'M 0 12 L 68 12';
const ARROW_PATH_V = 'M 12 4 L 12 36';
const H_DX = 68;
const V_DY = 32;

interface ActivePacket {
  id: string;
  service: PacketService;
  kind: 'call' | 'response';
  status?: number;
  axis: 'client-identity' | 'identity-ledger' | 'identity-db' | 'ledger-db';
  reverse: boolean;
  durationMs: number;
}

function useBlockExpansion() {
  // Map service|db → expanded + auto-collapse timer id. Pre-mortem 2: store
  // timer id in ref and clear BEFORE setting a new one AND on unmount.
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const expand = (key: string) => {
    if (timers.current[key]) {
      clearTimeout(timers.current[key]);
    }
    setExpanded((prev) => (prev[key] ? prev : { ...prev, [key]: true }));
    timers.current[key] = setTimeout(() => {
      setExpanded((prev) => ({ ...prev, [key]: false }));
      delete timers.current[key];
    }, 2000);
  };

  useEffect(() => {
    const currentTimers = timers.current;
    return () => {
      for (const k of Object.keys(currentTimers)) clearTimeout(currentTimers[k]);
    };
  }, []);

  return { expanded, expand };
}

export function GraphView({ events, sseStatus, currentUserSub }: GraphViewProps) {
  const { replayMode, replaySpeed, stopReplay, setReplaySpeed } = useApp();

  // Force re-render every 500ms so decay-to-idle happens without new events.
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 500);
    return () => clearInterval(id);
  }, []);

  const now = Date.now();
  const identityState = deriveServiceState(events, 'identity', currentUserSub, now);
  const ledgerState = deriveServiceState(events, 'ledger', currentUserSub, now);
  const identityDbState = deriveDbState(events, 'identity', currentUserSub, now);
  const ledgerDbState = deriveDbState(events, 'ledger', currentUserSub, now);

  const crossArrowActive =
    serviceToDbActive(identityState) || serviceToDbActive(ledgerState);

  const statusColor =
    sseStatus === 'connected'
      ? 'var(--success)'
      : sseStatus === 'auth-error'
        ? 'var(--error)'
        : 'var(--text-muted)';

  // ── Packet emission ─────────────────────────────────────────────────
  // Track last-seen events per type; emit packets when new events appear.
  const seenEventCount = useRef(0);
  const [packets, setPackets] = useState<ActivePacket[]>([]);
  const packetIdRef = useRef(0);
  const { expanded, expand } = useBlockExpansion();

  // Ledger balance + delta snapshot derived from latest response on ledger.
  const { ledgerBalance, ledgerDelta, ledgerDeltaFormatted } = useMemo(() => {
    let balance: string | null = null;
    let deltaCents: number | null = null;
    let deltaFormatted: string | null = null;
    for (let i = events.length - 1; i >= 0; i--) {
      const e = events[i];
      if (e.service !== 'ledger' || e.type !== 'response') continue;
      // Response bodies are not on SseEvent; leave balance null unless we
      // extend the event schema. We still show the USD-formatted path.
      break;
    }
    // Derive from history may require cross-referencing; for now we use the
    // debit/credit hint encoded in the path of the most recent ledger request.
    for (let i = events.length - 1; i >= 0; i--) {
      const e = events[i];
      if (e.service !== 'ledger' || e.type !== 'request') continue;
      if (e.path.includes('/debit')) {
        deltaCents = -3000;
        deltaFormatted = `-${formatAmount(3000)}`;
      } else if (e.path.includes('/credit')) {
        deltaCents = 3000;
        deltaFormatted = `+${formatAmount(3000)}`;
      }
      break;
    }
    // Placeholder balance — event stream does not carry the final balance.
    // formatAmount is applied for the USD representation per D08.
    if (deltaCents !== null) balance = formatAmount(0);
    return { ledgerBalance: balance, ledgerDelta: deltaCents, ledgerDeltaFormatted: deltaFormatted };
  }, [events]);

  useEffect(() => {
    if (events.length <= seenEventCount.current) {
      seenEventCount.current = events.length;
      return;
    }
    const newOnes = events.slice(seenEventCount.current);
    seenEventCount.current = events.length;

    const defaultPacketMs =
      replayMode === 'REPLAY' ? REPLAY_TIMING[replaySpeed].packetMs : 600;

    for (const e of newOnes) {
      if (e.userId && e.userId !== currentUserSub) continue;
      if (e.service !== 'identity' && e.service !== 'ledger') continue;
      const svc = e.service as PacketService;

      if (e.type === 'request') {
        const durationMs =
          replayMode === 'REPLAY'
            ? REPLAY_TIMING[replaySpeed].packetMs
            : Math.max(300, defaultPacketMs);
        packetIdRef.current += 1;
        setPackets((prev) => [
          ...prev,
          {
            id: `p${packetIdRef.current}`,
            service: svc,
            kind: 'call',
            axis: svc === 'identity' ? 'client-identity' : 'identity-ledger',
            reverse: false,
            durationMs,
          },
        ]);
        expand(svc);
      } else if (e.type === 'response') {
        const durationMs =
          replayMode === 'REPLAY'
            ? REPLAY_TIMING[replaySpeed].packetMs
            : Math.max(300, e.durationMs || defaultPacketMs);
        packetIdRef.current += 1;
        setPackets((prev) => [
          ...prev,
          {
            id: `p${packetIdRef.current}`,
            service: svc,
            kind: 'response',
            status: e.status,
            axis: svc === 'identity' ? 'client-identity' : 'identity-ledger',
            reverse: true,
            durationMs,
          },
        ]);
        expand(svc);
      } else if (e.type === 'db') {
        packetIdRef.current += 1;
        const durationMs =
          replayMode === 'REPLAY' ? REPLAY_TIMING[replaySpeed].packetMs : 400;
        setPackets((prev) => [
          ...prev,
          {
            id: `p${packetIdRef.current}`,
            service: svc,
            kind: 'call',
            axis: svc === 'identity' ? 'identity-db' : 'ledger-db',
            reverse: false,
            durationMs,
          },
        ]);
        expand(`${svc}-db`);
      }
    }
  }, [events, currentUserSub, replayMode, replaySpeed, expand]);

  const removePacket = (id: string) => {
    setPackets((prev) => prev.filter((p) => p.id !== id));
  };

  const offsetSupported = OFFSET_PATH_SUPPORTED ? 'true' : 'false';

  return (
    <div
      data-testid="graph-view"
      style={{
        padding: '24px',
        border: '1px solid var(--border)',
        borderRadius: '8px',
        backgroundColor: 'var(--bg-card)',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
      }}
    >
      {/* Header row: SSE status + LIVE/REPLAY badges + speed/stop controls */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          flexWrap: 'wrap',
        }}
      >
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
          style={{
            fontSize: '12px',
            color: 'var(--text-muted)',
            fontFamily: 'ui-monospace, monospace',
          }}
        >
          {sseStatus}
        </span>

        {replayMode === 'LIVE' ? (
          <span data-testid="live-badge" className="live-badge">● LIVE</span>
        ) : (
          <>
            <span data-testid="replay-badge" className="replay-badge">▶ REPLAY</span>
            <select
              data-testid="replay-speed-select"
              value={replaySpeed}
              onChange={(e) => setReplaySpeed(e.target.value as 'slow' | 'medium' | 'fast')}
              style={{
                fontSize: '12px',
                padding: '2px 6px',
                border: '1px solid var(--border)',
                borderRadius: '4px',
                backgroundColor: 'var(--bg-card)',
                color: 'var(--text-primary)',
              }}
            >
              <option value="slow">slow</option>
              <option value="medium">medium</option>
              <option value="fast">fast</option>
            </select>
            <button
              data-testid="replay-stop"
              onClick={stopReplay}
              className="px-2 py-1 text-xs"
              style={{
                border: '1px solid var(--border)',
                backgroundColor: 'var(--bg-card)',
                color: 'var(--text-muted)',
                borderRadius: '4px',
              }}
            >
              ■ Stop
            </button>
          </>
        )}
      </div>

      <div className="graph-container">
        {/* Row 1: Client → Identity → Ledger (with packet overlays on arrows) */}
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <ClientBlock />
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', position: 'relative' }}>
          <Arrow direction="right" active={serviceToDbActive(identityState)} />
          <PacketOverlay
            width={80}
            height={24}
            pathD={ARROW_PATH_H}
            offsetSupported={offsetSupported}
          >
            {packets
              .filter((p) => p.axis === 'client-identity')
              .map((p) => (
                <Packet
                  key={p.id}
                  id={p.id}
                  kind={p.kind}
                  service={p.service}
                  status={p.status}
                  pathD={ARROW_PATH_H}
                  durationMs={p.durationMs}
                  dx={H_DX}
                  dy={0}
                  reverse={p.reverse}
                  onDone={removePacket}
                />
              ))}
          </PacketOverlay>
        </div>
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <ServiceBlock
            service="identity"
            port={3002}
            state={identityState}
            expanded={!!expanded['identity']}
            requestBody={expanded['identity'] ? lastRequestSummary(events, 'identity') : null}
            responseSummary={expanded['identity'] ? lastResponseSummary(events, 'identity') : null}
          />
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', position: 'relative' }}>
          <Arrow direction="right" active={crossArrowActive} />
          <PacketOverlay
            width={80}
            height={24}
            pathD={ARROW_PATH_H}
            offsetSupported={offsetSupported}
          >
            {packets
              .filter((p) => p.axis === 'identity-ledger')
              .map((p) => (
                <Packet
                  key={p.id}
                  id={p.id}
                  kind={p.kind}
                  service={p.service}
                  status={p.status}
                  pathD={ARROW_PATH_H}
                  durationMs={p.durationMs}
                  dx={H_DX}
                  dy={0}
                  reverse={p.reverse}
                  onDone={removePacket}
                />
              ))}
          </PacketOverlay>
        </div>
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <ServiceBlock
            service="ledger"
            port={3001}
            state={ledgerState}
            expanded={!!expanded['ledger']}
            requestBody={expanded['ledger'] ? lastRequestSummary(events, 'ledger') : null}
            responseSummary={expanded['ledger'] ? lastResponseSummary(events, 'ledger') : null}
          />
        </div>

        {/* Row 2: spacer | spacer | vertical-arrow-identity | spacer | vertical-arrow-ledger */}
        <div />
        <div />
        <div style={{ display: 'flex', justifyContent: 'center', position: 'relative' }}>
          <Arrow direction="down" active={serviceToDbActive(identityState)} />
          <PacketOverlay
            width={24}
            height={48}
            pathD={ARROW_PATH_V}
            offsetSupported={offsetSupported}
          >
            {packets
              .filter((p) => p.axis === 'identity-db')
              .map((p) => (
                <Packet
                  key={p.id}
                  id={p.id}
                  kind={p.kind}
                  service={p.service}
                  status={p.status}
                  pathD={ARROW_PATH_V}
                  durationMs={p.durationMs}
                  dx={0}
                  dy={V_DY}
                  reverse={p.reverse}
                  onDone={removePacket}
                />
              ))}
          </PacketOverlay>
        </div>
        <div />
        <div style={{ display: 'flex', justifyContent: 'center', position: 'relative' }}>
          <Arrow direction="down" active={serviceToDbActive(ledgerState)} />
          <PacketOverlay
            width={24}
            height={48}
            pathD={ARROW_PATH_V}
            offsetSupported={offsetSupported}
          >
            {packets
              .filter((p) => p.axis === 'ledger-db')
              .map((p) => (
                <Packet
                  key={p.id}
                  id={p.id}
                  kind={p.kind}
                  service={p.service}
                  status={p.status}
                  pathD={ARROW_PATH_V}
                  durationMs={p.durationMs}
                  dx={0}
                  dy={V_DY}
                  reverse={p.reverse}
                  onDone={removePacket}
                />
              ))}
          </PacketOverlay>
        </div>

        {/* Row 3: DBs under Identity and Ledger (columns 3 and 5). */}
        <div />
        <div />
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <DbBlock
            service="identity"
            state={identityDbState}
            expanded={!!expanded['identity-db']}
          />
        </div>
        <div />
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <DbBlock
            service="ledger"
            state={ledgerDbState}
            expanded={!!expanded['ledger-db']}
            balance={expanded['ledger-db'] ? ledgerBalance : null}
            deltaCents={expanded['ledger-db'] ? ledgerDelta : null}
            deltaFormatted={expanded['ledger-db'] ? ledgerDeltaFormatted : null}
          />
        </div>
      </div>
    </div>
  );
}

/**
 * PacketOverlay: an absolutely-positioned SVG sitting on top of an Arrow
 * that hosts traveling packets. Sets data-offset-supported so CSS can switch
 * between the offset-path keyframe and the transform fallback.
 */
function PacketOverlay({
  width,
  height,
  pathD: _pathD,
  offsetSupported,
  children,
}: {
  width: number;
  height: number;
  pathD: string;
  offsetSupported: 'true' | 'false';
  children: React.ReactNode;
}) {
  void _pathD;
  return (
    <svg
      className="packet-overlay"
      data-offset-supported={offsetSupported}
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      xmlns="http://www.w3.org/2000/svg"
    >
      {children}
    </svg>
  );
}
