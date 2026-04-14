exports.up = async function (knex) {
  await knex.raw(`
    CREATE TABLE IF NOT EXISTS balance_snapshots (
      user_id TEXT PRIMARY KEY,
      amount BIGINT NOT NULL DEFAULT 0,
      version INTEGER NOT NULL DEFAULT 1,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
};

exports.down = async function (knex) {
  await knex.raw('DROP TABLE IF EXISTS balance_snapshots');
};
