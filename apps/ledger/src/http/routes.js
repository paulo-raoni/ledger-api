import { registerInternalRoutes } from './internalRoutes.js';

export async function registerRoutes(app, deps) {
  const { createTransaction, listTransactions, getBalance, verifyInternalJwt, idempotencyHook } =
    deps;

  app.post('/transactions', { preHandler: idempotencyHook }, async (req, reply) => {
    const authUserId = req.user?.sub;
    const idempotencyKey = req.idempotencyKey ?? null;
    const created = await createTransaction(req.body, authUserId, idempotencyKey);
    if (idempotencyKey) {
      req.idempotencySavedInTx = true;
    }
    return reply.send(created);
  });

  app.get('/transactions', async (req, reply) => {
    const authUserId = req.user?.sub;
    const list = await listTransactions(req.query, authUserId);
    return reply.send(list);
  });

  app.get('/balance', async (req, reply) => {
    const authUserId = req.user?.sub;
    const balance = await getBalance(authUserId);
    return reply.send(balance);
  });

  await app.register(
    async (internalApp) => {
      await registerInternalRoutes(internalApp, {
        getBalanceByUserId: getBalance,
        verifyInternalJwt,
      });
    },
    { prefix: '/internal' },
  );
}
