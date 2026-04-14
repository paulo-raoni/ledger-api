export function Spinner({ testId }: { testId?: string }) {
  return <div className="spinner" data-testid={testId ?? 'spinner'} />;
}
