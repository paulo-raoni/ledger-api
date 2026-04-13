import { z } from 'zod';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { Errors, mustGetEnv } from '@ledger/shared';

const authSchema = z.union([
  z.object({
    email: z
      .string()
      .min(3)
      .transform((v) => v.trim().toLowerCase()),
    password: z.string().min(1),
  }),
  z
    .object({
      user: z.object({
        email: z
          .string()
          .min(3)
          .transform((v) => v.trim().toLowerCase()),
        password: z.string().min(1),
      }),
    })
    .transform((v) => v.user),
]);

export function authUserUseCase(repo) {
  const externalSecret = mustGetEnv('JWT_EXTERNAL_SECRET');

  return async (body) => {
    const data = authSchema.parse(body);

    const user = await repo.findByEmail(data.email);
    if (!user) throw Errors.unauthorized('Invalid credentials');

    const ok = await bcrypt.compare(data.password, user.password_hash);
    if (!ok) throw Errors.unauthorized('Invalid credentials');

    const access_token = jwt.sign({ sub: user.id }, externalSecret, { expiresIn: '1h' });

    return {
      user: {
        id: user.id,
        first_name: user.first_name,
        last_name: user.last_name,
        email: user.email,
      },
      access_token,
    };
  };
}
