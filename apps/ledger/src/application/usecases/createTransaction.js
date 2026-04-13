import { z } from 'zod';
import { AppError, Errors } from '@ledger/shared';
import { randomUUID } from 'node:crypto';
import { withTransaction } from '../../infra/db/withTransaction.js';

const schema = z.object({
  user_id: z.string().min(1),
  type: z.enum(['CREDIT', 'DEBIT']),
  amount: z.number().int().positive(),
});

export function createTransactionUseCase({ pool, repo, idempotencyRepo, usersClient }) {
  return async function execute(input, authUserId, idempotencyKey) {
    const parsed = schema.safeParse(input);
    if (!parsed.success) {
      throw Errors.badRequest('Invalid request body');
    }

    const data = parsed.data;

    if (data.user_id !== authUserId) {
      throw Errors.forbidden('user_id does not match authenticated user');
    }

    // Verify user exists outside the transaction (HTTP call)
    await usersClient.assertUserExists(data.user_id);

    const id = randomUUID();

    const created = await withTransaction(pool, async (client) => {
      const balance = await repo.getBalanceByUserForUpdate(client, data.user_id);

      if (data.type === 'DEBIT' && balance < data.amount) {
        throw new AppError('Insufficient balance', 422, 'INSUFFICIENT_BALANCE');
      }

      const transaction = await repo.insertTransactionTx(client, {
        id,
        user_id: data.user_id,
        type: data.type,
        amount: data.amount,
      });

      if (idempotencyKey) {
        await idempotencyRepo.saveTx(client, idempotencyKey, data.user_id, 200, transaction);
      }

      return transaction;
    });

    return created;
  };
}
