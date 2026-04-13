import { logger } from '@ledger/shared';

export async function runMigrations(pool) {
  await pool.query(`
    CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

    CREATE TABLE IF NOT EXISTS users (
      id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      first_name text NOT NULL,
      last_name text NOT NULL,
      email text NOT NULL UNIQUE,
      password_hash text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );

    CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);
  `);

  logger.info('identity migrations ensured');
}
