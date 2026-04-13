import { z } from 'zod';
import { Errors } from '@ledger/shared';

const querySchema = z.object({
  type: z.enum(['CREDIT', 'DEBIT']).optional(),
});

export function listTransactionsUseCase(repo) {
  return async function execute(query, authUserId) {
    const parsed = querySchema.safeParse(query);
    if (!parsed.success) {
      throw Errors.badRequest('Invalid query params');
    }

    return repo.listTransactionsByUser({
      user_id: authUserId,
      type: parsed.data.type,
    });
  };
}
