import { useState } from 'react';
import { useApp } from '../contexts/AppContext';
import { EndpointCard } from '../components/EndpointCard';
import { HistoryPanel } from '../components/HistoryPanel';
import { TokenPill } from '../components/TokenPill';
import { DbInspector } from '../components/DbInspector/DbInspector';
import type { EndpointDef } from '../components/EndpointCard';

const IDENTITY_BASE = 'http://localhost:3002';
const LEDGER_BASE = 'http://localhost:3001';

const IDENTITY_ENDPOINTS: EndpointDef[] = [
  {
    id: 'post-users',
    service: 'identity',
    method: 'POST',
    path: '/users',
    description: 'Register a new user account.',
    requiresAuth: false,
    fields: [
      { name: 'first_name', label: 'First name', type: 'text', required: true },
      { name: 'last_name', label: 'Last name', type: 'text', required: true },
      { name: 'email', label: 'Email', type: 'email', required: true },
      { name: 'password', label: 'Password', type: 'password', required: true },
    ],
  },
  {
    id: 'post-auth',
    service: 'identity',
    method: 'POST',
    path: '/auth',
    description: 'Login and receive a signed JWT.',
    requiresAuth: false,
    fields: [
      { name: 'email', label: 'Email', type: 'email', required: true },
      { name: 'password', label: 'Password', type: 'password', required: true },
    ],
  },
  {
    id: 'get-users',
    service: 'identity',
    method: 'GET',
    path: '/users',
    description: 'List all users.',
    requiresAuth: true,
  },
  {
    id: 'get-users-id',
    service: 'identity',
    method: 'GET',
    path: '/users/:id',
    description: 'Fetch a user by ID.',
    requiresAuth: true,
    pathParam: 'id',
    fields: [{ name: 'id', label: 'User ID', type: 'text', required: true }],
  },
  {
    id: 'patch-users-id',
    service: 'identity',
    method: 'PATCH',
    path: '/users/:id',
    description: 'Update user fields.',
    requiresAuth: true,
    pathParam: 'id',
    fields: [
      { name: 'id', label: 'User ID', type: 'text', required: true },
      { name: 'first_name', label: 'First name', type: 'text', optional: true },
      { name: 'last_name', label: 'Last name', type: 'text', optional: true },
    ],
  },
  {
    id: 'delete-users-id',
    service: 'identity',
    method: 'DELETE',
    path: '/users/:id',
    description: 'Delete a user (requires zero balance).',
    requiresAuth: true,
    pathParam: 'id',
    fields: [{ name: 'id', label: 'User ID', type: 'text', required: true }],
  },
];

const LEDGER_ENDPOINTS: EndpointDef[] = [
  {
    id: 'post-transactions',
    service: 'ledger',
    method: 'POST',
    path: '/transactions',
    description: 'Create a CREDIT or DEBIT transaction.',
    requiresAuth: true,
    fields: [
      { name: 'type', label: 'Type', type: 'select', options: ['CREDIT', 'DEBIT'], required: true },
      { name: 'amount', label: 'Amount (cents)', type: 'number', required: true },
      { name: 'idempotency_key', label: 'Idempotency-Key', type: 'text', optional: true },
    ],
  },
  {
    id: 'get-transactions',
    service: 'ledger',
    method: 'GET',
    path: '/transactions',
    description: 'List transactions, optionally filtered by type.',
    requiresAuth: true,
    fields: [
      { name: 'type', label: 'Filter by type', type: 'select', options: ['', 'CREDIT', 'DEBIT'], optional: true },
    ],
  },
  {
    id: 'get-balance',
    service: 'ledger',
    method: 'GET',
    path: '/balance',
    description: 'Get current balance (O(1) snapshot read).',
    requiresAuth: true,
  },
];

async function sendRequest(
  endpoint: EndpointDef,
  fields: Record<string, string>,
  token: string | null,
): Promise<{ status: number; body: unknown; latencyMs: number }> {
  const base = endpoint.service === 'identity' ? IDENTITY_BASE : LEDGER_BASE;
  let path = endpoint.path;

  // Resolve path params
  if (endpoint.pathParam && fields[endpoint.pathParam]) {
    path = path.replace(`:${endpoint.pathParam}`, fields[endpoint.pathParam]);
  }

  // Build query string for GET with filter
  if (endpoint.method === 'GET' && fields['type']) {
    path = `${path}?type=${fields['type']}`;
  }

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (fields['idempotency_key']) headers['Idempotency-Key'] = fields['idempotency_key'];

  let body: object | undefined;
  if (endpoint.method !== 'GET' && endpoint.method !== 'DELETE') {
    const bodyFields: Record<string, unknown> = {};
    for (const f of endpoint.fields ?? []) {
      if (f.name === 'idempotency_key' || f.name === endpoint.pathParam) continue;
      if (f.name === 'type' && endpoint.id === 'get-transactions') continue;
      const val = fields[f.name];
      if (val !== undefined && val !== '') {
        bodyFields[f.name] = f.type === 'number' ? Number(val) : val;
      }
    }
    // Inject extra fields not in endpoint.fields (e.g. user_id injected by handleSend)
    const knownFieldNames = new Set((endpoint.fields ?? []).map(f => f.name));
    for (const [k, v] of Object.entries(fields)) {
      if (!knownFieldNames.has(k) && k !== 'idempotency_key' && v !== undefined && v !== '') {
        bodyFields[k] = v;
      }
    }
    if (Object.keys(bodyFields).length > 0) body = bodyFields;
  }

  const start = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);

  try {
    const res = await fetch(`${base}${path}`, {
      method: endpoint.method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
    clearTimeout(timeout);
    const resBody = await res.json().catch(() => null);
    return { status: res.status, body: resBody, latencyMs: Date.now() - start };
  } catch {
    clearTimeout(timeout);
    throw new Error('Cannot reach service');
  }
}

export function Playground() {
  const { token, setToken, setUserId, addHistory } = useApp();
  const [dbOpen, setDbOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  const handleSend = async (
    endpoint: EndpointDef,
    fields: Record<string, string>,
  ): Promise<{ status: number; body: unknown; latencyMs: number }> => {
    const result = await sendRequest(endpoint, fields, token);

    // Extract token from /auth response
    if (endpoint.id === 'post-auth' && result.status === 200) {
      const body = result.body as Record<string, unknown>;
      if (body?.access_token) {
        setToken(body.access_token as string);
      }
    }

    // Extract userId from /users POST response
    if (endpoint.id === 'post-users' && result.status === 200) {
      const body = result.body as Record<string, unknown>;
      if (body?.id) {
        setUserId(body.id as string);
      }
    }

    addHistory({
      method: endpoint.method,
      path: endpoint.path,
      status: result.status,
      latencyMs: result.latencyMs,
      responseBody: result.body,
      timestamp: new Date(),
    });

    return result;
  };

  return (
    <div className="flex gap-4">
      {/* Main area */}
      <div className="flex-1 min-w-0 flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <button
            data-testid="db-view-btn"
            onClick={() => setDbOpen(true)}
            className="px-3 py-1.5 text-xs rounded font-semibold"
            style={{ backgroundColor: 'var(--bg-card)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}
          >
            🗄 View DB State
          </button>
          <button
            data-testid="history-toggle-mobile"
            onClick={() => setHistoryOpen((o) => !o)}
            className="sm:hidden px-3 py-1.5 text-xs rounded font-semibold"
            style={{ backgroundColor: 'var(--bg-card)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}
          >
            📋 History
          </button>
          <TokenPill />
        </div>

        {/* History panel — mobile only, shown when toggled */}
        {historyOpen && (
          <div className="sm:hidden">
            <HistoryPanel />
          </div>
        )}

        {/* Identity section */}
        <div data-testid="section-identity">
          <div
            className="text-xs font-semibold uppercase tracking-wide px-1 mb-2"
            style={{ color: 'var(--identity)' }}
          >
            Identity :3002
          </div>
          <div className="flex flex-col gap-2">
            {IDENTITY_ENDPOINTS.map((ep) => (
              <EndpointCard key={ep.id} endpoint={ep} onSend={handleSend} />
            ))}
          </div>
        </div>

        {/* Ledger section */}
        <div data-testid="section-ledger">
          <div
            className="text-xs font-semibold uppercase tracking-wide px-1 mb-2"
            style={{ color: 'var(--ledger)' }}
          >
            Ledger :3001
          </div>
          <div className="flex flex-col gap-2">
            {LEDGER_ENDPOINTS.map((ep) => (
              <EndpointCard key={ep.id} endpoint={ep} onSend={handleSend} />
            ))}
          </div>
        </div>
      </div>

      {/* History sidebar — desktop only */}
      <div className="hidden sm:block" style={{ width: 280, flexShrink: 0 }}>
        <HistoryPanel />
      </div>

      {dbOpen && <DbInspector onClose={() => setDbOpen(false)} />}
    </div>
  );
}
