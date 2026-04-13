import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { Errors } from '@ledger/shared';
import { BCRYPT_ROUNDS } from './constants.js';

const paramsSchema = z.object({ id: z.string().min(1) });

const patchSchema = z
  .object({
    first_name: z.string().min(1).optional(),
    last_name: z.string().min(1).optional(),
    email: z
      .string()
      .min(3)
      .optional()
      .transform((v) => v?.trim().toLowerCase()),
    password: z.string().min(6).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, 'Empty patch');

export function updateUserUseCase(repo) {
  return async (params, body) => {
    const { id } = paramsSchema.parse(params);
    const patch = patchSchema.parse(body);

    const update = {};
    if (patch.first_name) update.first_name = patch.first_name;
    if (patch.last_name) update.last_name = patch.last_name;
    if (patch.email) update.email = patch.email;
    if (patch.password) update.password_hash = await bcrypt.hash(patch.password, BCRYPT_ROUNDS);

    const updated = await repo.update(id, update);
    if (!updated) throw Errors.notFound('User not found');

    return updated;
  };
}
