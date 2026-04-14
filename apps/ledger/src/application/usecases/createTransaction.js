import { z } from 'zod';
import { AppError, Errors } from '@ledger/shared';
import { randomUUID } from 'node:crypto';
import { withTransaction } from '../../infra/db/withTransaction.js';

const schema = z.object({
  type: z.enum(['CREDIT', 'DEBIT']),
  amount: z.number().int().positive(),
});

export function createTransactionUseCase({ pool, repo, idempotencyRepo, usersClient, snapshotRepo }) {
  return async function execute(input, authUserId, idempotencyKey) {
    const parsed = schema.safeParse(input);
    if (!parsed.success) {
      throw Errors.badRequest('Invalid request body');
    }

    const data = parsed.data;

    // Verify user exists outside the transaction (HTTP call)
    await usersClient.assertUserExists(authUserId);

    const id = randomUUID();

    const created = await withTransaction(pool, async (client) => {
      await repo.lockUserForUpdate(client, authUserId);
      const balance = await repo.getBalanceByUser_tx(client, authUserId);

      if (data.type === 'DEBIT' && balance < data.amount) {
        throw new AppError('Insufficient balance', 422, 'INSUFFICIENT_BALANCE');
      }

      const transaction = await repo.insertTransactionTx(client, {
        id,
        user_id: authUserId,
        type: data.type,
        amount: data.amount,
      });

      const newBalance =
        data.type === 'CREDIT' ? balance + data.amount : balance - data.amount;
      await snapshotRepo.upsertTx(client, authUserId, newBalance);

      if (idempotencyKey) {
        await idempotencyRepo.saveTx(client, idempotencyKey, authUserId, 200, transaction);
      }

      return transaction;
    });

    return created;
  };
}
