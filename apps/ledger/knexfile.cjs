module.exports = {
  client: 'pg',
  connection: process.env.LEDGER_DB_URL,
  pool: { min: 0, max: 2 },
  migrations: {
    directory: './migrations',
  },
};
