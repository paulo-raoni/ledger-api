import { z } from 'zod';
import { Errors } from '@ledger/shared';
import { randomUUID } from 'node:crypto';

const schema = z.object({
  user_id: z.string().min(1),
  type: z.enum(['CREDIT', 'DEBIT']),
  amount: z.number().int().positive(),
});

export function createTransactionUseCase({ repo, usersClient }) {
  return async function execute(input, authUserId) {
    const parsed = schema.safeParse(input);
    if (!parsed.success) {
      throw Errors.badRequest('Invalid request body');
    }

    const data = parsed.data;

    if (data.user_id !== authUserId) {
      throw Errors.forbidden('user_id does not match authenticated user');
    }

    const id = randomUUID();

    // Ensure the user still exists before creating the transaction
    await usersClient.assertUserExists(data.user_id);

    const created = await repo.insertTransaction({
      id,
      user_id: data.user_id,
      type: data.type,
      amount: data.amount,
    });

    return created;
  };
}
