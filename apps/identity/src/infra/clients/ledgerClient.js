import jwt from 'jsonwebtoken';
import { mustGetEnv, AppError } from '@ledger/shared';

function createInternalToken(userId) {
  const internalSecret = mustGetEnv('JWT_INTERNAL_SECRET');
  return jwt.sign({ sub: userId, internal: true }, internalSecret, { expiresIn: '5m' });
}

export function ledgerClient() {
  const baseUrl = mustGetEnv('LEDGER_INTERNAL_BASE_URL').replace(/\/+$/, '');

  return {
    async getBalanceByUserId(userId) {
      const token = createInternalToken(userId);

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 4000);

      try {
        const res = await fetch(`${baseUrl}/internal/balance/${encodeURIComponent(userId)}`, {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          signal: controller.signal,
        });

        if (!res.ok) {
          const body = await res.text().catch(() => '');
          throw new AppError(
            `Failed to fetch wallet balance (status ${res.status}) ${body ? `- ${body}` : ''}`.trim(),
            502,
            'UPSTREAM_ERROR',
          );
        }

        const json = await res.json();
        if (typeof json?.amount !== 'number') {
          throw new AppError('Invalid wallet balance response', 502, 'UPSTREAM_ERROR');
        }

        return json;
      } catch (err) {
        if (err?.name === 'AbortError') {
          throw new AppError('Wallet balance request timed out', 504, 'UPSTREAM_TIMEOUT');
        }
        throw err;
      } finally {
        clearTimeout(timeout);
      }
    },
  };
}
