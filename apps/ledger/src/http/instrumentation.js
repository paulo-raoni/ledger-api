import { emit } from '../events/eventBus.js';

const SKIP_PATHS = new Set(['/events', '/health']);

function shouldSkip(request) {
  // routerPath may be undefined early in the lifecycle; skip in that case.
  if (!request.routerPath) return true;
  if (SKIP_PATHS.has(request.routerPath)) return true;
  if (!request.user?.sub) return true;
  return false;
}

/**
 * Registers onRequest / onResponse / onError hooks that emit events for the
 * current authenticated user. Must be registered AFTER the auth hook so
 * `request.user` is populated, and AFTER the /events route so routerPath
 * matches correctly on skip paths.
 */
export function registerInstrumentation(fastify) {
  fastify.addHook('onRequest', (request, _reply, done) => {
    // Mark start time for duration calculation in case reply.elapsedTime is absent.
    request.__startTime = Date.now();
    if (shouldSkip(request)) return done();
    emit({
      type: 'request',
      method: request.method,
      path: request.routerPath,
      userId: request.user.sub,
    });
    done();
  });

  fastify.addHook('onResponse', (request, reply, done) => {
    if (shouldSkip(request)) return done();
    const durationMs =
      typeof reply.elapsedTime === 'number'
        ? reply.elapsedTime
        : Date.now() - (request.__startTime || Date.now());
    emit({
      type: 'response',
      status: reply.statusCode,
      durationMs,
      userId: request.user.sub,
    });
    done();
  });

  fastify.addHook('onError', (request, reply, err, done) => {
    if (shouldSkip(request)) return done();
    emit({
      type: 'error',
      status: reply.statusCode || 500,
      message: err.message,
      code: err.code,
      userId: request.user.sub,
    });
    done();
  });
}

// Exposed for unit testing of the skip predicate.
export const __test__ = { shouldSkip };
