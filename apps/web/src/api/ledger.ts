const BASE = 'http://localhost:3001';

async function request(
  method: string,
  path: string,
  options: { token?: string; body?: object; idempotencyKey?: string } = {},
): Promise<{ status: number; body: unknown; latencyMs: number }> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (options.token) headers['Authorization'] = `Bearer ${options.token}`;
  if (options.idempotencyKey) headers['Idempotency-Key'] = options.idempotencyKey;

  const start = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);

  try {
    const res = await fetch(`${BASE}${path}`, {
      method,
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: controller.signal,
    });
    clearTimeout(timeout);
    const body = await res.json().catch(() => null);
    return { status: res.status, body, latencyMs: Date.now() - start };
  } catch (err) {
    clearTimeout(timeout);
    throw err;
  }
}

export const ledger = {
  createTransaction: (token: string, data: object, idempotencyKey?: string) =>
    request('POST', '/transactions', { token, body: data, idempotencyKey }),
  listTransactions: (token: string, type?: string) =>
    request('GET', `/transactions${type ? `?type=${type}` : ''}`, { token }),
  getBalance: (token: string) => request('GET', '/balance', { token }),
  health: () => request('GET', '/health'),
};
