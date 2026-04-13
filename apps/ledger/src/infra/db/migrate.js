import { logger } from '@ledger/shared';

export async function runMigrations(pool) {
  const sql = `
    CREATE TABLE IF NOT EXISTS transactions (
      id UUID PRIMARY KEY,
      user_id TEXT NOT NULL,
      type TEXT NOT NULL CHECK (type IN ('CREDIT', 'DEBIT')),
      amount INTEGER NOT NULL CHECK (amount > 0),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_transactions_user_id_created_at
      ON transactions (user_id, created_at DESC);

    CREATE INDEX IF NOT EXISTS idx_transactions_type
      ON transactions (type);
  `;

  await pool.query(sql);
  logger.info('ledger migrations ensured');
}
