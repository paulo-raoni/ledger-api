import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { Errors } from '@ledger/shared';
import { BCRYPT_ROUNDS } from './constants.js';

const createUserSchema = z.object({
  first_name: z.string().min(1),
  last_name: z.string().min(1),
  email: z
    .string()
    .min(3)
    .transform((v) => v.trim().toLowerCase()),
  password: z.string().min(6),
});

export function createUserUseCase(repo) {
  return async (body) => {
    const data = createUserSchema.parse(body);

    const existing = await repo.findByEmail(data.email);
    if (existing) throw Errors.conflict('Email already in use');

    const password_hash = await bcrypt.hash(data.password, BCRYPT_ROUNDS);

    const created = await repo.create({
      first_name: data.first_name,
      last_name: data.last_name,
      email: data.email,
      password_hash,
    });

    return created;
  };
}
