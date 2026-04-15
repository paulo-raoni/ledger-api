import { z } from 'zod';
import { AppError, Errors } from '@ledger/shared';
import { randomUUID } from 'node:crypto';
import { withTransaction } from '../../infra/db/withTransaction.js';
import { emit } from '../../events/eventBus.js';

const schema = z.object({
  type: z.enum(['CREDIT', 'DEBIT']),
  amount: z.number().int().positive(),
});

async function timedDb({ operation, table, userId, requestId }, fn) {
  emit({ type: 'db', phase: 'start', operation, table, userId, requestId });
  const t0 = Date.now();
  try {
    const result = await fn();
    emit({
      type: 'db',
      phase: 'end',
      operation,
      table,
      durationMs: Date.now() - t0,
      userId,
      requestId,
    });
    return result;
  } catch (err) {
    emit({
      type: 'db',
      phase: 'end',
      operation,
      table,
      durationMs: Date.now() - t0,
      userId,
      requestId,
      error: err.message,
    });
    throw err;
  }
}

export function createTransactionUseCase({ pool, repo, idempotencyRepo, usersClient, snapshotRepo }) {
  return async function execute(input, authUserId, idempotencyKey, requestId = null) {
    const parsed = schema.safeParse(input);
    if (!parsed.success) {
      throw Errors.badRequest('Invalid request body');
    }

    const data = parsed.data;

    // Verify user exists outside the transaction (HTTP call)
    await usersClient.assertUserExists(authUserId);

    const id = randomUUID();

    const created = await withTransaction(pool, async (client) => {
      await timedDb(
        { operation: 'SELECT FOR UPDATE', table: 'advisory_lock', userId: authUserId, requestId },
        () => repo.lockUserForUpdate(client, authUserId),
      );

      const balance = await timedDb(
        { operation: 'SELECT', table: 'transactions', userId: authUserId, requestId },
        () => repo.getBalanceByUser_tx(client, authUserId),
      );

      if (data.type === 'DEBIT' && balance < data.amount) {
        throw new AppError('Insufficient balance', 422, 'INSUFFICIENT_BALANCE');
      }

      const transaction = await timedDb(
        { operation: 'INSERT', table: 'transactions', userId: authUserId, requestId },
        () =>
          repo.insertTransactionTx(client, {
            id,
            user_id: authUserId,
            type: data.type,
            amount: data.amount,
          }),
      );

      const newBalance =
        data.type === 'CREDIT' ? balance + data.amount : balance - data.amount;
      await timedDb(
        { operation: 'UPSERT', table: 'balance_snapshots', userId: authUserId, requestId },
        () => snapshotRepo.upsertTx(client, authUserId, newBalance),
      );

      if (idempotencyKey) {
        await timedDb(
          { operation: 'INSERT', table: 'idempotency_keys', userId: authUserId, requestId },
          () =>
            idempotencyRepo.saveTx(client, idempotencyKey, authUserId, 200, transaction),
        );
      }

      return transaction;
    });

    emit({ type: 'db', phase: 'end', operation: 'COMMIT', table: 'transactions', durationMs: 0, userId: authUserId, requestId });

    return created;
  };
}
