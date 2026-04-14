import { useState, type FormEvent } from 'react';
import { useApp } from '../contexts/AppContext';
import { ServiceBadge } from './ServiceBadge';
import { StatusBadge } from './StatusBadge';
import { Spinner } from './Spinner';
import { JsonBlock } from './JsonBlock';

export interface EndpointDef {
  id: string;
  service: 'identity' | 'ledger';
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  path: string;
  description: string;
  fields?: FieldDef[];
  requiresAuth?: boolean;
  pathParam?: string;
}

export interface FieldDef {
  name: string;
  label: string;
  type: 'text' | 'email' | 'password' | 'number' | 'select';
  options?: string[];
  required?: boolean;
  optional?: boolean;
}

interface EndpointCardProps {
  endpoint: EndpointDef;
  onSend: (
    endpoint: EndpointDef,
    fields: Record<string, string>,
  ) => Promise<{ status: number; body: unknown; latencyMs: number }>;
}

function validateFields(fields: Record<string, string>, defs: FieldDef[]): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const f of defs) {
    const val = fields[f.name] ?? '';
    if (f.required && !val) errors[f.name] = `${f.label} is required`;
    if (f.type === 'email' && val && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val))
      errors[f.name] = 'Invalid email format';
    if (f.type === 'number' && val) {
      const n = Number(val);
      if (isNaN(n) || n < 1) errors[f.name] = 'Amount must be at least 1 cent';
    }
  }
  return errors;
}

export function EndpointCard({ endpoint, onSend }: EndpointCardProps) {
  const { token } = useApp();
  const [active, setActive] = useState(false);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<{ status: number; body: unknown; latencyMs: number } | null>(null);

  const needsAuth = endpoint.requiresAuth ?? true;
  const missingToken = needsAuth && !token;

  const handleSend = async (e: FormEvent) => {
    e.preventDefault();
    const fieldDefs = endpoint.fields ?? [];
    const errs = validateFields(fields, fieldDefs.filter((f) => !f.optional));
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }
    setErrors({});
    setLoading(true);
    try {
      const result = await onSend(endpoint, fields);
      setResponse(result);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      data-testid={`endpoint-${endpoint.method}-${endpoint.id}`}
      className="rounded-lg p-3 cursor-pointer transition-colors"
      style={{
        backgroundColor: active ? 'var(--bg-card)' : 'var(--bg-base)',
        border: `1px solid ${active ? 'var(--border-active)' : 'var(--border)'}`,
      }}
      onClick={() => !active && setActive(true)}
    >
      <div className="flex items-center gap-2">
        <ServiceBadge service={endpoint.service} testId={`endpoint-badge-${endpoint.id}`} />
        <span className="text-xs font-mono font-semibold" style={{ color: 'var(--text-muted)' }}>
          {endpoint.method}
        </span>
        <span className="text-xs font-mono flex-1" style={{ color: 'var(--text-code)' }}>
          {endpoint.path}
        </span>
        {response && <StatusBadge status={response.status} testId="endpoint-status" />}
      </div>
      <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
        {endpoint.description}
      </div>

      {active && (
        <form onSubmit={handleSend} className="mt-3 space-y-2" onClick={(e) => e.stopPropagation()}>
          {missingToken && (
            <div
              data-testid="endpoint-login-required"
              className="text-xs px-2 py-1 rounded"
              style={{ color: 'var(--warning)', backgroundColor: 'rgba(245,158,11,0.1)', border: '1px solid var(--warning)' }}
            >
              ⚠ Login required
            </div>
          )}
          {(endpoint.fields ?? []).map((f) => (
            <div key={f.name}>
              <label className="block text-xs mb-0.5" style={{ color: 'var(--text-muted)' }}>
                {f.label}{f.optional ? ' (optional)' : ''}
              </label>
              {f.type === 'select' ? (
                <select
                  data-testid={`field-${f.name}`}
                  value={fields[f.name] ?? f.options?.[0] ?? ''}
                  onChange={(e) => setFields((p) => ({ ...p, [f.name]: e.target.value }))}
                  className="w-full text-xs p-1.5 rounded"
                  style={{ backgroundColor: 'var(--bg-input)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}
                >
                  {f.options?.map((o) => <option key={o}>{o}</option>)}
                </select>
              ) : (
                <input
                  data-testid={`field-${f.name}`}
                  type={f.type}
                  step={f.type === 'number' ? '1' : undefined}
                  value={fields[f.name] ?? ''}
                  onChange={(e) => setFields((p) => ({ ...p, [f.name]: e.target.value }))}
                  className="w-full text-xs p-1.5 rounded"
                  style={{ backgroundColor: 'var(--bg-input)', color: 'var(--text-primary)', border: `1px solid ${errors[f.name] ? 'var(--error)' : 'var(--border)'}` }}
                />
              )}
              {errors[f.name] && (
                <div data-testid={`field-error-${f.name}`} className="text-xs mt-0.5" style={{ color: 'var(--error)' }}>
                  {errors[f.name]}
                </div>
              )}
            </div>
          ))}
          <div className="flex justify-end">
            <button
              type="submit"
              data-testid="endpoint-send"
              disabled={loading || missingToken}
              className="px-3 py-1.5 text-xs rounded font-semibold flex items-center gap-1.5 disabled:opacity-50"
              style={{ backgroundColor: 'var(--ledger)', color: '#fff' }}
            >
              {loading && <Spinner testId="endpoint-loading" />}
              Send
            </button>
          </div>
          {response && (
            <div data-testid="endpoint-response">
              <JsonBlock data={response.body} />
            </div>
          )}
        </form>
      )}
    </div>
  );
}
