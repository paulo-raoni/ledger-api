export function idempotencyRepository(pool) {
  return {
    async findByKeyAndUser(key, userId) {
      const { rows } = await pool.query(
        `SELECT key, user_id, response_status, response_body
         FROM idempotency_keys
         WHERE key = $1 AND user_id = $2`,
        [key, userId],
      );
      return rows[0] ?? null;
    },

    async saveWithCTE(key, userId, responseStatus, responseBody) {
      const { rows } = await pool.query(
        `WITH ins AS (
           INSERT INTO idempotency_keys (key, user_id, response_status, response_body)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (key, user_id) DO NOTHING
           RETURNING *
         )
         SELECT * FROM ins
         UNION ALL
         SELECT * FROM idempotency_keys
         WHERE key = $1 AND user_id = $2 AND NOT EXISTS (SELECT 1 FROM ins)`,
        [key, userId, responseStatus, JSON.stringify(responseBody)],
      );
      return rows[0];
    },
  };
}
