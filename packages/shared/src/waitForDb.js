import { logger } from './logger.js';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function waitForDb(pool, opts = {}) {
  const { retries = 20, delayMs = 500 } = opts;

  for (let i = 1; i <= retries; i++) {
    try {
      await pool.query('SELECT 1');
      logger.info(`db is ready (attempt ${i}/${retries})`);
      return;
    } catch (err) {
      const isLast = i === retries;
      logger.warn(`db not ready yet (attempt ${i}/${retries}): ${err.code || err.message}`);
      if (isLast) throw err;
      await sleep(delayMs);
    }
  }
}
