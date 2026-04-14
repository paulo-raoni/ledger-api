import { PostgreSqlContainer } from '@testcontainers/postgresql';
import { Pool } from 'pg';
import knex from 'knex';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.resolve(__dirname, '../../../migrations');

let container;
let pool;
let db;

export async function setup() {
  container = await new PostgreSqlContainer('postgres:16-alpine').start();

  const connectionString = container.getConnectionUri();

  db = knex({
    client: 'pg',
    connection: connectionString,
    pool: { min: 0, max: 2 },
    migrations: { directory: migrationsDir },
  });

  await db.migrate.latest();

  pool = new Pool({
    connectionString,
    max: 20,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  });

  return { pool, db, connectionString };
}

export async function teardown() {
  try {
    if (pool) await pool.end();
  } catch {
    // pool already closed
  }
  try {
    if (db) await db.destroy();
  } catch {
    // knex already destroyed
  }
  try {
    if (container) await container.stop();
  } catch {
    // container already stopped — testcontainers Ryuk handles cleanup
  }
}
