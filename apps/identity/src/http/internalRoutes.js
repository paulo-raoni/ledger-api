import { Errors, parseBearer } from '@ledger/shared';
import { z } from 'zod';

export async function registerInternalRoutes(app, deps) {
  const { getUser, verifyInternalJwt } = deps;

  app.addHook('preHandler', async (req) => {
    const token = parseBearer(req.headers.authorization);
    if (!token) throw Errors.unauthorized('Missing Bearer token');

    try {
      const payload = verifyInternalJwt(token);
      if (payload?.internal !== true) throw new Error('missing internal flag');
      req.internalAuth = payload;
    } catch {
      throw Errors.unauthorized('Invalid internal token');
    }
  });

  app.get('/users/:id', async (req, reply) => {
    const { id } = z.object({ id: z.string().min(1) }).parse(req.params);

    await getUser({ id });
    return reply.send({ ok: true });
  });
}
