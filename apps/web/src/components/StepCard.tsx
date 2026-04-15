import { ServiceBadge } from './ServiceBadge';
import { StatusBadge } from './StatusBadge';
import { JsonBlock } from './JsonBlock';
import { Spinner } from './Spinner';
import type { StepDef, StepResult, StepStatus } from '../flows/demoFlow';

interface StepCardProps {
  step: StepDef;
  result?: StepResult;
  status: StepStatus;
  showDescription?: boolean;
}

export function StepCard({ step, result, status, showDescription }: StepCardProps) {
  const isLoading = status === 'active' && !result;
  const isErrorExpected = status === 'error-expected';
  const isErrorUnexpected = status === 'error-unexpected';

  let borderColor = 'var(--border)';
  let extraClass = '';
  if (status === 'active') {
    borderColor = step.service === 'identity' ? 'var(--identity)' : 'var(--ledger)';
  } else if (isErrorExpected) {
    borderColor = 'var(--error)';
    extraClass = 'error-pulse';
  } else if (isErrorUnexpected) {
    borderColor = 'var(--error)';
  }

  const resolvedPath = result?.resolvedPath ?? step.path;

  return (
    <div
      data-testid="step-card"
      className={`card step-card step-enter ${extraClass}`}
      style={{
        backgroundColor: 'var(--bg-card)',
        border: `1px solid ${borderColor}`,
        boxShadow: status === 'active' ? `0 0 8px ${borderColor}40` : undefined,
      }}
    >
      <div className="step-header flex items-center gap-2 mb-3">
        <ServiceBadge service={step.service} testId="step-service-badge" />
        <span data-testid="step-method" className="badge-method font-mono font-semibold" style={{ color: 'var(--text-muted)' }}>
          {step.method}
        </span>
        <span data-testid="step-path" className="badge-path font-mono" style={{ color: 'var(--text-code)' }}>
          {resolvedPath}
        </span>
        {result && (
          <>
            <StatusBadge status={result.responseStatus} testId="step-status-badge" />
            <span data-testid="step-latency" className="latency">
              {result.latencyMs}ms
            </span>
          </>
        )}
      </div>

      <div data-testid="step-title" className="step-title mb-2" style={{ color: 'var(--text-primary)' }}>
        {step.title}
      </div>

      {result?.requestHeaders?.['Idempotency-Key'] && (
        <div data-testid="step-idempotency-key" className="idempotency-key-header text-xs mb-2 font-mono" style={{ color: 'var(--text-muted)' }}>
          Idempotency-Key: {result.requestHeaders['Idempotency-Key']}
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-3">
        <div>
          {result?.requestBody && (
            <JsonBlock data={result.requestBody} testId="step-request-body" label="REQUEST" />
          )}
        </div>
        <div className={result || isLoading ? 'response-section' : ''}>
          {isLoading ? (
            <div className="flex items-center gap-2 mt-4">
              <Spinner testId="step-loading" />
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>loading...</span>
            </div>
          ) : result ? (
            <JsonBlock data={result.responseBody} testId="step-response-body" label="RESPONSE" />
          ) : null}
        </div>
      </div>

      {isErrorExpected && (
        <div
          data-testid="step-error-expected"
          className="mt-2 px-2 py-1 rounded text-xs font-semibold inline-block"
          style={{ backgroundColor: 'rgba(245,158,11,0.15)', color: 'var(--warning)', border: '1px solid var(--warning)' }}
        >
          Expected
        </div>
      )}

      {isErrorUnexpected && (
        <div data-testid="step-error-unexpected" className="mt-2 p-3 rounded" style={{ backgroundColor: 'rgba(239,68,68,0.1)', border: '1px solid var(--error)' }}>
          <div className="text-sm font-medium mb-1" style={{ color: 'var(--error)' }}>
            {result?.responseStatus === 401
              ? 'Session expired'
              : result?.responseStatus === 0 && result?.responseBody
                ? String((result.responseBody as Record<string, unknown>).error ?? 'Cannot reach service')
                : 'Cannot reach service'}
          </div>
          <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {result?.responseStatus === 401
              ? 'Press Restart to begin a new session.'
              : 'Is docker-compose running?'}
          </div>
        </div>
      )}

      {showDescription && (
        <div className="mt-3 pt-3" style={{ borderTop: '1px solid var(--border)' }}>
          <p data-testid="step-description" className="text-sm" style={{ color: 'var(--text-primary)' }}>
            {step.description}
          </p>
          <p data-testid="step-why" className="text-xs italic mt-1" style={{ color: 'var(--text-muted)' }}>
            Why it matters: {step.whyItMatters}
          </p>
        </div>
      )}
    </div>
  );
}
