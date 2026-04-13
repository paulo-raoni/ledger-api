import { z } from 'zod';
import { Errors } from '@ledger/shared';

const paramsSchema = z.object({ id: z.string().min(1) });

export function deleteUserUseCase(deps) {
  const { usersRepository, ledgerClient } = deps;

  return async (params) => {
    const { id } = paramsSchema.parse(params);

    const { amount } = await ledgerClient.getBalanceByUserId(id);

    if (amount !== 0) {
      throw Errors.conflict('Cannot delete user with non-zero wallet balance');
    }

    await usersRepository.delete(id);

    return { ok: true };
  };
}
