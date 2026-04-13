import jwt from 'jsonwebtoken';
import { mustGetEnv, Errors } from '@ledger/shared';

function buildInternalToken() {
  const secret = mustGetEnv('JWT_INTERNAL_SECRET');
  return jwt.sign({ sub: 'ledger-service', internal: true }, secret, { expiresIn: '5m' });
}

export function identityClient(fetchImpl = fetch) {
  const baseUrl = mustGetEnv('IDENTITY_INTERNAL_BASE_URL');

  async function exists(userId) {
    const token = buildInternalToken();

    const res = await fetchImpl(`${baseUrl}/internal/users/${userId}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    });

    if (res.status === 404) return false;
    if (!res.ok) throw Errors.badGateway('Identity service error');
    return true;
  }

  async function assertUserExists(userId) {
    const ok = await exists(userId);
    if (!ok) throw Errors.notFound('User not found');
  }

  return { exists, assertUserExists };
}
