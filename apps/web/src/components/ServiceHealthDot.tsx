import { useState, useEffect } from 'react';

type HealthState = 'checking' | 'up' | 'down';

interface ServiceHealthDotProps {
  service: 'identity' | 'ledger';
  url: string;
}

export function ServiceHealthDot({ service, url }: ServiceHealthDotProps) {
  const [state, setState] = useState<HealthState>('checking');

  const check = async () => {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3_000);
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeout);
      setState(res.ok ? 'up' : 'down');
    } catch {
      setState('down');
    }
  };

  useEffect(() => {
    check();
    const interval = setInterval(check, 10_000);
    return () => clearInterval(interval);
  }, [url]); // eslint-disable-line react-hooks/exhaustive-deps

  const color =
    state === 'up' ? 'var(--success)' : state === 'down' ? 'var(--error)' : 'var(--warning)';
  const label =
    state === 'up' ? `${service} online` : state === 'down' ? `${service} down` : `${service} checking`;

  return (
    <span
      data-testid={`health-dot-${service}`}
      aria-label={label}
      title={label}
      className={`inline-block w-2 h-2 rounded-full ${state === 'checking' ? 'pulse-dot' : ''}`}
      style={{ backgroundColor: color }}
    />
  );
}
