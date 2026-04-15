import { ApiError, NetworkError } from './errors';

const BASE = 'http://localhost:3001';

async function request(
  method: string,
  path: string,
  options: { token?: string; body?: object; idempotencyKey?: string } = {},
): Promise<unknown> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (options.token) headers['Authorization'] = `Bearer ${options.token}`;
  if (options.idempotencyKey) headers['Idempotency-Key'] = options.idempotencyKey;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);

  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      method,
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: controller.signal,
    });
  } catch {
    clearTimeout(timeout);
    throw new NetworkError();
  }
  clearTimeout(timeout);

  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string; code?: string };
    throw new ApiError(res.status, body.message ?? res.statusText, body.code);
  }
  return res.json();
}

export const ledger = {
  createTransaction: (token: string, data: object, idempotencyKey?: string) =>
    request('POST', '/transactions', { token, body: data, idempotencyKey }),
  listTransactions: (token: string, type?: string) =>
    request('GET', `/transactions${type ? `?type=${type}` : ''}`, { token }),
  getBalance: (token: string) => request('GET', '/balance', { token }),
  health: () => request('GET', '/health'),
};
