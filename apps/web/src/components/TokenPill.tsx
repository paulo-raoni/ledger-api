import { useState } from 'react';
import { useApp } from '../contexts/AppContext';

export function TokenPill() {
  const { token } = useApp();
  const [copied, setCopied] = useState(false);

  if (!token) return null;

  const truncated = token.slice(0, 24) + '...';

  const handleCopy = async () => {
    await navigator.clipboard.writeText(token);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div
      data-testid="token-pill"
      className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs"
      style={{
        border: '1px solid var(--identity)',
        backgroundColor: 'var(--bg-card)',
        fontFamily: 'JetBrains Mono, Fira Code, monospace',
        color: 'var(--text-code)',
      }}
    >
      <span>🔑 Bearer {truncated}</span>
      <button
        data-testid={copied ? 'token-copied' : 'token-copy'}
        onClick={handleCopy}
        className="px-1.5 py-0.5 rounded text-xs transition-colors"
        style={{
          backgroundColor: copied ? 'var(--success)' : 'var(--border)',
          color: copied ? '#fff' : 'var(--text-muted)',
        }}
      >
        {copied ? '✓ Copied' : 'Copy'}
      </button>
    </div>
  );
}
