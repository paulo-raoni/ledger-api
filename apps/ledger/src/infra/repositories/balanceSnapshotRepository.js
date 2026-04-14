// amount is BIGINT (vs INTEGER for transactions.amount) — individual amounts fit in INTEGER
// but accumulated balances can exceed INTEGER range. JavaScript Number() is safe below
// Number.MAX_SAFE_INTEGER (9,007,199,254,740,991 cents ≈ $90 trillion).
export function balanceSnapshotRepository(pool) {
  return {
    async getByUserId(userId) {
      const { rows } = await pool.query(
        'SELECT amount FROM balance_snapshots WHERE user_id = $1',
        [userId],
      );
      return rows[0] ?? null;
    },

    async upsertTx(client, userId, amount) {
      await client.query(
        `
        INSERT INTO balance_snapshots (user_id, amount, version)
        VALUES ($1, $2, 1)
        ON CONFLICT (user_id) DO UPDATE
        SET amount = $2, version = balance_snapshots.version + 1, updated_at = NOW()
        `,
        [userId, amount],
      );
    },
  };
}
