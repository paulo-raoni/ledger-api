const IDENTITY = 'http://localhost:3002';
const LEDGER = 'http://localhost:3001';

export async function createUser(suffix = Date.now()) {
  const email = `test+${suffix}@e2e.com`;
  const res = await fetch(`${IDENTITY}/users`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      first_name: 'Test', last_name: 'User',
      email, password: 'test1234',
    }),
  });
  const user = await res.json();
  return { ...user, email, password: 'test1234' };
}

export async function getToken(email: string, password: string) {
  const res = await fetch(`${IDENTITY}/auth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  return { token: data.access_token, userId: data.user?.id ?? data.id };
}

export async function creditAccount(token: string, amount: number) {
  return fetch(`${LEDGER}/transactions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ type: 'CREDIT', amount }),
  });
}

export async function debitAccount(token: string, amount: number) {
  return fetch(`${LEDGER}/transactions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ type: 'DEBIT', amount }),
  });
}

export async function getBalance(token: string): Promise<number> {
  const res = await fetch(`${LEDGER}/balance`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json();
  return data.amount;
}

export async function cleanupUser(token: string, userId: string) {
  const balance = await getBalance(token);
  if (balance > 0) await debitAccount(token, balance);
  await fetch(`${IDENTITY}/users/${userId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
}
