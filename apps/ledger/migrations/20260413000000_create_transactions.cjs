exports.up = async function (knex) {
  await knex.raw(`
    CREATE TABLE IF NOT EXISTS transactions (
      id UUID PRIMARY KEY,
      user_id TEXT NOT NULL,
      type TEXT NOT NULL CHECK (type IN ('CREDIT', 'DEBIT')),
      amount INTEGER NOT NULL CHECK (amount > 0),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await knex.raw(`
    CREATE INDEX IF NOT EXISTS idx_transactions_user_id_created_at
      ON transactions (user_id, created_at DESC)
  `);

  await knex.raw(`
    CREATE INDEX IF NOT EXISTS idx_transactions_type
      ON transactions (type)
  `);
};

exports.down = async function (knex) {
  await knex.raw('DROP TABLE IF EXISTS transactions');
};
