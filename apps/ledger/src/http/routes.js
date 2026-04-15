import { registerInternalRoutes } from './internalRoutes.js';
import { registerIdempotency } from './hooks/idempotencyHook.js';

export async function registerRoutes(app, deps) {
  const { createTransaction, listTransactions, getBalance, verifyInternalJwt, idempotencyRepo } =
    deps;

  await registerIdempotency(app, { idempotencyRepo });

  app.post('/transactions', {
    schema: {
      body: {
        type: 'object',
        required: ['type', 'amount'],
        properties: {
          type: { type: 'string', enum: ['CREDIT', 'DEBIT'] },
          amount: { type: 'number', minimum: 0.01 },
          idempotencyKey: { type: 'string' },
        },
        additionalProperties: false,
      },
    },
  }, async (req, reply) => {
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
