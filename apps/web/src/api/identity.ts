import { ApiError, NetworkError } from './errors';

const BASE = 'http://localhost:3002';

async function request(
  method: string,
  path: string,
  options: { token?: string; body?: object } = {},
): Promise<unknown> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (options.token) headers['Authorization'] = `Bearer ${options.token}`;

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

export const identity = {
  createUser: (data: object) => request('POST', '/users', { body: data }),
  auth: (data: object) => request('POST', '/auth', { body: data }),
  listUsers: (token: string) => request('GET', '/users', { token }),
  getUser: (token: string, id: string) => request('GET', `/users/${id}`, { token }),
  updateUser: (token: string, id: string, data: object) =>
    request('PATCH', `/users/${id}`, { token, body: data }),
  deleteUser: (token: string, id: string) => request('DELETE', `/users/${id}`, { token }),
  health: () => request('GET', '/health'),
};
