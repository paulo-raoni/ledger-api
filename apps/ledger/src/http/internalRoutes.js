import { z } from 'zod';
import { Errors } from '@ledger/shared';

export async function registerInternalRoutes(app, deps) {
  const { getBalanceByUserId, verifyInternalJwt } = deps;

  app.addHook('preHandler', async (req) => {
    const auth = req.headers.authorization;
    if (!auth?.startsWith('Bearer ')) throw Errors.unauthorized('Missing token');

    const token = auth.slice('Bearer '.length);
    try {
      const payload = verifyInternalJwt(token);
      req.internalAuth = payload;
    } catch {
      throw Errors.unauthorized('Invalid internal token');
    }
  });

  app.get('/balance/:userId', async (req, reply) => {
    const { userId } = z.object({ userId: z.string().min(1) }).parse(req.params);

    const sub = req.internalAuth?.sub;
    if (!sub) throw Errors.unauthorized('Invalid internal token');

    if (sub !== userId) {
      throw Errors.forbidden('token subject does not match requested user');
    }

    if (req.internalAuth?.internal !== true) {
      throw Errors.forbidden('internal token required');
    }

    const balance = await getBalanceByUserId(userId);
    return reply.send(balance);
  });
}
