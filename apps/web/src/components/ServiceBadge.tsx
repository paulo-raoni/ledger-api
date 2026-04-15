interface ServiceBadgeProps {
  service: 'identity' | 'ledger';
  testId?: string;
}

export function ServiceBadge({ service, testId }: ServiceBadgeProps) {
  const isIdentity = service === 'identity';
  return (
    <span
      data-testid={testId ?? 'step-service-badge'}
      className={`badge-service inline-flex items-center px-2 py-0.5 font-mono font-semibold ${isIdentity ? 'badge-service-identity' : 'badge-service-ledger'}`}
    >
      {isIdentity ? 'IDENTITY :3002' : 'LEDGER :3001'}
    </span>
  );
}
