export function usersRepository(pool) {
  return {
    async findByEmail(email) {
      const res = await pool.query(
        `SELECT id, first_name, last_name, email, password_hash
         FROM users
         WHERE email = $1
         LIMIT 1`,
        [email],
      );
      return res.rows[0] || null;
    },

    async findById(id) {
      const res = await pool.query(
        `SELECT id, first_name, last_name, email
         FROM users
         WHERE id = $1
         LIMIT 1`,
        [id],
      );
      return res.rows[0] || null;
    },

    async list() {
      const res = await pool.query(
        `SELECT id, first_name, last_name, email
         FROM users
         ORDER BY created_at DESC`,
      );
      return res.rows;
    },

    async create({ first_name, last_name, email, password_hash }) {
      const res = await pool.query(
        `INSERT INTO users (first_name, last_name, email, password_hash)
         VALUES ($1, $2, $3, $4)
         RETURNING id, first_name, last_name, email`,
        [first_name, last_name, email, password_hash],
      );
      return res.rows[0];
    },

    async update(id, patch) {
      const fields = [];
      const values = [];
      let idx = 1;

      for (const [key, value] of Object.entries(patch)) {
        fields.push(`${key} = $${idx++}`);
        values.push(value);
      }

      if (fields.length === 0) return this.findById(id);

      values.push(id);

      const res = await pool.query(
        `UPDATE users
         SET ${fields.join(', ')}, updated_at = now()
         WHERE id = $${idx}
         RETURNING id, first_name, last_name, email`,
        values,
      );

      return res.rows[0] || null;
    },

    async delete(id) {
      await pool.query(`DELETE FROM users WHERE id = $1`, [id]);
      return true;
    },
  };
}
