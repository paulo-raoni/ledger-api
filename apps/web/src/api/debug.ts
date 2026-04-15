const IDENTITY = 'http://localhost:3002';
const LEDGER = 'http://localhost:3001';

export interface IdentityDb {
  users: Array<Record<string, unknown>>;
}

export interface LedgerDb {
  transactions: Array<Record<string, unknown>>;
  balance_snapshots: Array<Record<string, unknown>>;
  idempotency_keys: Array<Record<string, unknown>>;
}

async function fetchDb<T>(url: string): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5_000);
  try {
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json() as Promise<T>;
  } catch (err) {
    clearTimeout(timeout);
    throw err;
  }
}

export async function fetchBothDbs(): Promise<{ identity: IdentityDb; ledger: LedgerDb }> {
  const [identity, ledger] = await Promise.all([
    fetchDb<IdentityDb>(`${IDENTITY}/debug/db`),
    fetchDb<LedgerDb>(`${LEDGER}/debug/db`),
  ]);
  return { identity, ledger };
}

export async function resetDb(service: 'identity' | 'ledger'): Promise<{ truncated: string[] }> {
  const port = service === 'identity' ? 3002 : 3001;
  const res = await fetch(`http://localhost:${port}/debug/reset?confirm=YES`, { method: 'DELETE' });
  if (!res.ok) throw new Error(`Reset failed: ${res.status}`);
  return res.json() as Promise<{ truncated: string[] }>;
}
