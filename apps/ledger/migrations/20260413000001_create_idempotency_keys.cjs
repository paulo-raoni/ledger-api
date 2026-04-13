exports.up = async function (knex) {
  await knex.raw(`
    CREATE TABLE IF NOT EXISTS idempotency_keys (
      key TEXT NOT NULL,
      user_id TEXT NOT NULL,
      response_status INTEGER NOT NULL,
      response_body JSONB NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (key, user_id)
    )
  `);

  await knex.raw(`
    CREATE INDEX IF NOT EXISTS idx_idempotency_keys_created_at
      ON idempotency_keys (created_at)
  `);
};

exports.down = async function (knex) {
  await knex.raw('DROP TABLE IF EXISTS idempotency_keys');
};
