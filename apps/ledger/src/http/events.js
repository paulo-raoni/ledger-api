import jwt from 'jsonwebtoken';
import { mustGetEnv } from '@ledger/shared';
import { eventBus } from '../events/eventBus.js';

/**
 * Registers GET /events on the given Fastify instance.
 *
 * Auth: Bearer header OR ?token=<jwt> query param. EventSource in browsers
 * cannot attach headers, so a query-param fallback is required.
 *
 * Response: text/event-stream, per-user filtered via request.user.sub.
 * A single close handler removes the listener AND clears the keepalive
 * interval — no duplicate cleanup paths.
 */
export async function registerEventsRoute(fastify) {
  const externalSecret = mustGetEnv('JWT_EXTERNAL_SECRET');

  fastify.get('/events', async (request, reply) => {
    const header = request.headers.authorization;
    const headerToken =
      header && header.startsWith('Bearer ') ? header.slice('Bearer '.length) : null;
    const queryToken = typeof request.query?.token === 'string' ? request.query.token : null;
    const token = headerToken || queryToken;

    if (!token) {
      return reply.status(401).send({ error: 'UNAUTHORIZED', message: 'Missing token' });
    }

    let payload;
    try {
      payload = jwt.verify(token, externalSecret);
      if (!payload?.sub) throw new Error('missing sub');
    } catch {
      return reply.status(401).send({ error: 'UNAUTHORIZED', message: 'Invalid token' });
    }
    request.user = payload;

    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'Access-Control-Allow-Origin': request.headers.origin || '*',
      'Access-Control-Allow-Credentials': 'true',
    });

    const send = (event) => {
      // Per-user filter: only forward events belonging to this authenticated user.
      if (event.userId !== request.user.sub) return;
      reply.raw.write(`data: ${JSON.stringify(event)}\n\n`);
    };
    eventBus.on('event', send);

    const keepalive = setInterval(() => {
      reply.raw.write(': keepalive\n\n');
    }, 15000);

    // Single cleanup path: remove the listener AND stop the keepalive.
    request.raw.on('close', () => {
      eventBus.off('event', send);
      clearInterval(keepalive);
    });

    reply.hijack();
  });
}
