const KEY_PATTERN = /^[a-zA-Z0-9_-]{1,256}$/;

/**
 * Registers the idempotency plugin on the given Fastify instance.
 *
 * The Idempotency-Key header is optional. If absent, the request proceeds normally.
 * If present, the key is validated and checked against stored responses scoped to the
 * authenticated user. On a hit, the cached response is returned immediately. On a miss,
 * an onSend hook — registered ONCE at plugin load — captures and stores the response
 * after the handler completes, unless the use case already saved the key inside its
 * own transaction (signaled via request.idempotencySavedInTx).
 *
 * Cleanup: keys older than 24h can be pruned with:
 *   DELETE FROM idempotency_keys WHERE created_at < NOW() - INTERVAL '24 hours';
 */
export async function registerIdempotency(fastify, { idempotencyRepo }) {
  fastify.addHook('preHandler', async (request, reply) => {
    const key = request.headers['idempotency-key'];
    if (!key) return;

    if (!KEY_PATTERN.test(key)) {
      return reply.status(400).send({
        error: 'BAD_REQUEST',
        message: 'Idempotency-Key must be 1-256 alphanumeric characters, hyphens, or underscores',
      });
    }

    const userId = request.user?.sub;
    if (!userId) {
      return reply.status(401).send({ error: 'UNAUTHORIZED', message: 'Missing authenticated user' });
    }

    const cached = await idempotencyRepo.findByKeyAndUser(key, userId);
    if (cached) {
      return reply.status(cached.response_status).send(cached.response_body);
    }

    request.idempotencyKey = key;
    request.idempotencyUserId = userId;
    request.idempotencySavedInTx = false;
  });

  fastify.addHook('onSend', async (request, reply, payload) => {
    if (!request.idempotencyKey) return payload;
    if (request.idempotencySavedInTx) return payload;

    let body;
    try {
      body = typeof payload === 'string' ? JSON.parse(payload) : payload;
    } catch {
      return payload;
    }
    try {
      await idempotencyRepo.saveWithCTE(
        request.idempotencyKey,
        request.idempotencyUserId,
        reply.statusCode,
        body,
      );
    } catch (err) {
      request.log.error({ err }, 'idempotency: failed to save key');
    }
    return payload;
  });
}
