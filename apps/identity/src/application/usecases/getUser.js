import { z } from 'zod';
import { Errors } from '@ledger/shared';

const paramsSchema = z.object({ id: z.string().min(1) });

export function getUserUseCase(repo) {
  return async (params) => {
    const { id } = paramsSchema.parse(params);
    const user = await repo.findById(id);
    if (!user) throw Errors.notFound('User not found');
    return user;
  };
}
