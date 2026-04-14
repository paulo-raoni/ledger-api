interface ServiceBadgeProps {
  service: 'identity' | 'ledger';
  testId?: string;
}

export function ServiceBadge({ service, testId }: ServiceBadgeProps) {
  const isIdentity = service === 'identity';
  return (
    <span
      data-testid={testId ?? 'step-service-badge'}
      className="inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-semibold"
      style={{
        backgroundColor: isIdentity ? 'rgba(59,130,246,0.15)' : 'rgba(16,185,129,0.15)',
        color: isIdentity ? 'var(--identity)' : 'var(--ledger)',
        border: `1px solid ${isIdentity ? 'var(--identity)' : 'var(--ledger)'}`,
      }}
    >
      {isIdentity ? 'IDENTITY :3002' : 'LEDGER :3001'}
    </span>
  );
}
