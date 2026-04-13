import { Pool } from 'pg';
import { mustGetEnv } from '@ledger/shared';

export function createDbPool() {
  const connectionString = mustGetEnv('IDENTITY_DB_URL');

  const pool = new Pool({
    connectionString,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  });

  return pool;
}
