import { logger } from '@ledger/shared';

export async function runMigrations(db) {
  await db.migrate.latest();
  logger.info('identity migrations ensured');
}
