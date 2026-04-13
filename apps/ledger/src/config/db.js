import { Pool } from 'pg';
import knex from 'knex';
import { mustGetEnv } from '@ledger/shared';

export function createDbPool() {
  const connectionString = mustGetEnv('LEDGER_DB_URL');

  const pool = new Pool({
    connectionString,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  });

  return pool;
}

export function createDbKnex() {
  const connectionString = mustGetEnv('LEDGER_DB_URL');

  const db = knex({
    client: 'pg',
    connection: connectionString,
    pool: { min: 0, max: 2 },
  });

  return db;
}
