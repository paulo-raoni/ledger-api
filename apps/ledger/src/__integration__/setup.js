import { PostgreSqlContainer } from '@testcontainers/postgresql';
import { Pool } from 'pg';
import knex from 'knex';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.resolve(__dirname, '../../../migrations');

/**
 * Each call returns a fresh container, pool, and knex instance.
 * Callers must pass the returned context to teardown().
 */
export async function setup() {
  const container = await new PostgreSqlContainer('postgres:16-alpine').start();

  const connectionString = container.getConnectionUri();

  const db = knex({
    client: 'pg',
    connection: connectionString,
    pool: { min: 0, max: 2 },
    migrations: { directory: migrationsDir },
  });

  await db.migrate.latest();

  const pool = new Pool({
    connectionString,
    max: 20,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  });

  return { pool, db, connectionString, container };
}

export async function teardown(ctx) {
  try {
    if (ctx?.pool) await ctx.pool.end();
  } catch {
    // pool already closed
  }
  try {
    if (ctx?.db) await ctx.db.destroy();
  } catch {
    // knex already destroyed
  }
  try {
    if (ctx?.container) await ctx.container.stop();
  } catch {
    // container already stopped — testcontainers Ryuk handles cleanup
  }
}
