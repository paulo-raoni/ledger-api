export function transactionsRepository(pool) {
  return {
    async insertTransaction({ id, user_id, type, amount }) {
      const { rows } = await pool.query(
        `
        INSERT INTO transactions (id, user_id, type, amount)
        VALUES ($1, $2, $3, $4)
        RETURNING id, user_id, type, amount
        `,
        [id, user_id, type, amount],
      );
      return rows[0];
    },

    async listTransactionsByUser({ user_id, type }) {
      const params = [user_id];
      let where = `WHERE user_id = $1`;

      if (type) {
        params.push(type);
        where += ` AND type = $2`;
      }

      const { rows } = await pool.query(
        `
        SELECT id, user_id, type, amount
        FROM transactions
        ${where}
        ORDER BY created_at DESC
        LIMIT 200
        `,
        params,
      );

      return rows;
    },

    async getBalanceByUser({ user_id }) {
      const { rows } = await pool.query(
        `
        SELECT COALESCE(SUM(
          CASE
            WHEN type = 'CREDIT' THEN amount
            WHEN type = 'DEBIT' THEN -amount
            ELSE 0
          END
        ), 0) AS amount
        FROM transactions
        WHERE user_id = $1
        `,
        [user_id],
      );

      const value = rows?.[0]?.amount ?? 0;
      return Number(value);
    },
  };
}
