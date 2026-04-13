const KEY_PATTERN = /^[a-zA-Z0-9_-]{1,256}$/;

/**
 * Creates a Fastify preHandler hook that enforces idempotency for POST /transactions.
 *
 * The Idempotency-Key header is optional. If absent, the request proceeds normally.
 * If present, the key is validated and checked against stored responses scoped to the
 * authenticated user. On a hit, the cached response is returned immediately. On a miss,
 * an onSend hook captures and stores the response after the handler completes.
 *
 * NOTE: Between PR2 and PR3+PR4, the idempotency key INSERT and transaction INSERT are
 * NOT in the same DB transaction. PR3+PR4 closes this race window by wrapping both in a
 * single BEGIN/COMMIT inside the createTransaction use case.
 *
 * Cleanup: keys older than 24h can be pruned with:
 *   DELETE FROM idempotency_keys WHERE created_at < NOW() - INTERVAL '24 hours';
 */
export function makeIdempotencyHook(idempotencyRepo) {
  return async function idempotencyPreHandler(request, reply) {
    const key = request.headers['idempotency-key'];

    if (!key) {
      return;
    }

    if (!KEY_PATTERN.test(key)) {
      return reply.status(400).send({
        error: 'BAD_REQUEST',
        message: 'Idempotency-Key must be 1-256 alphanumeric characters, hyphens, or underscores',
      });
    }

    const userId = request.user?.sub;
    const cached = await idempotencyRepo.findByKeyAndUser(key, userId);

    if (cached) {
      return reply.status(cached.response_status).send(cached.response_body);
    }

    request.idempotencyKey = key;

    reply.addHook('onSend', async (_req, _reply, payload) => {
      if (request.idempotencyKey) {
        const status = _reply.statusCode;
        let body;
        try {
          body = typeof payload === 'string' ? JSON.parse(payload) : payload;
        } catch {
          body = payload;
        }
        await idempotencyRepo.saveWithCTE(request.idempotencyKey, userId, status, body);
      }
      return payload;
    });
  };
}
