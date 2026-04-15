import Fastify from 'fastify';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

import { mustGetEnv, parseBearer, Errors, logger, waitForDb } from '@ledger/shared';

import { createDbPool, createDbKnex } from './config/db.js';
import { runMigrations } from './infra/db/migrate.js';
import { transactionsRepository } from './infra/repositories/transactionsRepository.js';
import { idempotencyRepository } from './infra/repositories/idempotencyRepository.js';
import { balanceSnapshotRepository } from './infra/repositories/balanceSnapshotRepository.js';
import { identityClient } from './infra/clients/identityClient.js';

import { createTransactionUseCase } from './application/usecases/createTransaction.js';
import { listTransactionsUseCase } from './application/usecases/listTransactions.js';
import { getBalanceUseCase } from './application/usecases/getBalance.js';

import { registerRoutes } from './http/routes.js';
import { registerEventsRoute } from './http/events.js';
import { registerInstrumentation } from './http/instrumentation.js';

import cors from '@fastify/cors';

dotenv.config();

const port = Number(process.env.LEDGER_PORT || 3001);
const externalSecret = mustGetEnv('JWT_EXTERNAL_SECRET');
const internalSecret = mustGetEnv('JWT_INTERNAL_SECRET');

function verifyInternalJwt(token) {
  return jwt.verify(token, internalSecret);
}

const app = Fastify({ logger: false });

const allowedOrigins = new Set(['http://localhost:8081', 'http://localhost:8082', 'http://localhost:3000']);

await app.register(cors, {
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);
    return cb(null, allowedOrigins.has(origin));
  },
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Idempotency-Key'],
  optionsSuccessStatus: 204,
});

app.setErrorHandler((err, req, reply) => {
  const status = err.statusCode || 500;
  reply.status(status).send({
    error: err.code || 'INTERNAL_ERROR',
    message: err.message || 'Internal Server Error',
  });
});

app.addHook('onRequest', async (req) => {
  const path = (req.url || '').split('?')[0];
  if (path.startsWith('/internal')) return;
  if (path === '/health') return;
  if (path === '/debug/db') return;
  if (path === '/debug/reset') return;
  // /events authenticates internally (supports ?token=<jwt> for EventSource)
  if (path === '/events') return;

  const token = parseBearer(req.headers.authorization);
  if (!token) throw Errors.unauthorized('Missing Bearer token');

  try {
    const payload = jwt.verify(token, externalSecret);
    if (!payload?.sub) throw new Error('missing sub');
    req.user = payload;
  } catch {
    throw Errors.unauthorized('Invalid token');
  }
});

async function bootstrap() {
  const pool = createDbPool();
  const db = createDbKnex();
  await waitForDb(pool, { retries: 30, delayMs: 500 });
  await runMigrations(db);

  const repo = transactionsRepository(pool);
  const idempotencyRepo = idempotencyRepository(pool);
  const snapshotRepo = balanceSnapshotRepository(pool);
  const iClient = identityClient();

  const deps = {
    createTransaction: createTransactionUseCase({ pool, repo, idempotencyRepo, usersClient: iClient, snapshotRepo }),
    listTransactions: listTransactionsUseCase(repo),
    getBalance: getBalanceUseCase(repo, snapshotRepo),
    verifyInternalJwt,
    idempotencyRepo,
  };

  app.get('/status', async () => ({ ok: true, service: 'ledger' }));
  app.get('/health', (_req, res) => res.json({ ok: true }));

  if (process.env.NODE_ENV !== 'production') {
    app.get('/debug/db', async (_req, res) => {
      const [transactions, snapshots, idempotencyKeys] = await Promise.all([
        pool.query('SELECT id, user_id, type, amount, created_at FROM transactions ORDER BY created_at DESC'),
        pool.query('SELECT user_id, amount, updated_at FROM balance_snapshots ORDER BY updated_at DESC'),
        pool.query('SELECT key, user_id, response_status, response_body, created_at FROM idempotency_keys ORDER BY created_at DESC'),
      ]);
      res.json({
        transactions: transactions.rows,
        balance_snapshots: snapshots.rows,
        idempotency_keys: idempotencyKeys.rows,
      });
    });

    app.delete('/debug/reset', async (request, reply) => {
      if (request.query.confirm !== 'YES') {
        return reply.status(400).send({
          error: 'BAD_REQUEST',
          message: 'Pass ?confirm=YES to confirm reset',
        });
      }
      await pool.query('TRUNCATE transactions, balance_snapshots, idempotency_keys CASCADE');
      return reply.send({ truncated: ['transactions', 'balance_snapshots', 'idempotency_keys'] });
    });
  }

  // Register /events BEFORE instrumentation so routerPath === '/events' is
  // recognised by the skip predicate.
  await registerEventsRoute(app);
  registerInstrumentation(app);

  await registerRoutes(app, deps);

  app.addHook('onClose', async () => {
    await pool.end();
    await db.destroy();
  });

  await app.listen({ port, host: '0.0.0.0' });
  logger.info(`ledger listening on ${port}`);
}

bootstrap().catch((e) => {
  logger.error(e);
  process.exit(1);
});
