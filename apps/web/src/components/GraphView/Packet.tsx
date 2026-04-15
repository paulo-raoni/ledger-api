/**
 * Packet — PR 4 §4.2.
 *
 * An 8px-diameter circle that travels along an arrow path. Primary animation
 * uses `offset-path` / `offset-distance` (modern browsers). Fallback uses a
 * linear `transform: translate` between endpoints and is gated by the
 * `data-offset-supported="false"` attribute on the parent SVG (set once at
 * module scope from CSS.supports, per pre-mortem 6).
 *
 * Colors:
 *   kind === 'call'     → var(--identity) or var(--ledger) per target service
 *   kind === 'response' → var(--success) for 2xx, var(--error) for 4xx/5xx
 *
 * Timing: driven by --packet-duration CSS custom property (LIVE = max(300ms,
 * latencyMs); REPLAY = 2000/400/150ms per slow/medium/fast).
 *
 * Lifecycle: caller passes onDone; Packet invokes it on animationend so the
 * parent can remove the node from DOM.
 */

export type PacketKind = 'call' | 'response';
export type PacketService = 'identity' | 'ledger';

export interface PacketProps {
  id: string;
  kind: PacketKind;
  service: PacketService;
  status?: number; // response-only; 2xx → success, else error
  pathD: string; // SVG path "M x y L x y"
  durationMs: number;
  // Fallback endpoints (used when offset-path is unsupported).
  dx: number;
  dy: number;
  reverse?: boolean;
  onDone: (id: string) => void;
}

// Feature-detect once per session. CSS.supports exists in all target browsers,
// but guard against older environments just in case.
export const OFFSET_PATH_SUPPORTED: boolean = (() => {
  if (typeof CSS === 'undefined' || typeof CSS.supports !== 'function') return false;
  try {
    return CSS.supports('offset-path', 'path("M 0 0 L 1 1")');
  } catch {
    return false;
  }
})();

function classFor(p: PacketProps): string {
  if (p.kind === 'call') {
    return p.service === 'identity' ? 'packet packet-call-identity' : 'packet packet-call-ledger';
  }
  const ok = p.status !== undefined && p.status >= 200 && p.status < 300;
  return ok ? 'packet packet-response-ok' : 'packet packet-response-error';
}

export function Packet(props: PacketProps) {
  const { id, pathD, durationMs, dx, dy, reverse, onDone } = props;

  // For offset-path we need the path string as a CSS value. Response packets
  // traverse the same path but reversed via offset-distance direction.
  const offsetPath = `path('${pathD}')`;
  const inlineStyle: React.CSSProperties & Record<string, string | number> = {
    // Set CSS custom properties for both primary and fallback paths.
    '--packet-duration': `${durationMs}ms`,
    '--packet-dx': `${reverse ? -dx : dx}px`,
    '--packet-dy': `${reverse ? -dy : dy}px`,
    // Primary: offset-path with optional reverse via animation-direction.
    offsetPath,
    // Also set the legacy `motion-path` alias for safety on older Safari; tsc
    // accepts via index signature.
    motionPath: offsetPath,
    animationDirection: reverse ? 'reverse' : 'normal',
  };

  return (
    <circle
      data-testid={`packet-${id}`}
      className={classFor(props)}
      cx={0}
      cy={0}
      r={4}
      style={inlineStyle as React.CSSProperties}
      onAnimationEnd={() => onDone(id)}
    />
  );
}
