import Fastify from 'fastify';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

import { mustGetEnv, parseBearer, Errors, logger } from '@ledger/shared';
import { waitForDb } from '@ledger/shared';

import { createDbPool, createDbKnex } from './config/db.js';
import { runMigrations } from './infra/db/migrate.js';
import { usersRepository } from './infra/repositories/usersRepository.js';
import { ledgerClient } from './infra/clients/ledgerClient.js';

import { createUserUseCase } from './application/usecases/createUser.js';
import { authUserUseCase } from './application/usecases/authUser.js';
import { listUsersUseCase } from './application/usecases/listUsers.js';
import { getUserUseCase } from './application/usecases/getUser.js';
import { updateUserUseCase } from './application/usecases/updateUser.js';
import { deleteUserUseCase } from './application/usecases/deleteUser.js';

import { registerRoutes } from './http/routes.js';
import { registerInternalRoutes } from './http/internalRoutes.js';

import cors from '@fastify/cors';

dotenv.config();

const port = Number(process.env.IDENTITY_PORT || 3002);
const externalSecret = mustGetEnv('JWT_EXTERNAL_SECRET');
const internalSecret = mustGetEnv('JWT_INTERNAL_SECRET');

const app = Fastify({ logger: false });

const allowedOrigins = new Set(['http://localhost:8081', 'http://localhost:8082', 'http://localhost:3000']);

await app.register(cors, {
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);
    return cb(null, allowedOrigins.has(origin));
  },
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  optionsSuccessStatus: 204,
});

app.setErrorHandler((err, req, reply) => {
  const status = err.statusCode || 500;
  reply.status(status).send({
    error: err.code || 'INTERNAL_ERROR',
    message: err.message || 'Internal Server Error',
  });
});

function isPublicRoute(req) {
  const method = req.method;
  const path = (req.url || '').split('?')[0];

  if (method === 'POST' && path === '/users') return true;
  if (method === 'POST' && path === '/auth') return true;
  if (path.startsWith('/internal')) return true;
  if (path === '/health') return true;
  if (path === '/debug/db') return true;

  return false;
}

app.addHook('onRequest', async (req) => {
  if (isPublicRoute(req)) return;

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

  app.get('/health', (_req, res) => res.json({ ok: true }));

  if (process.env.NODE_ENV !== 'production') {
    app.get('/debug/db', async (_req, res) => {
      const result = await pool.query(
        'SELECT id, first_name, last_name, email, created_at FROM users ORDER BY created_at DESC'
      );
      res.json({ users: result.rows });
    });
  }

  const repo = usersRepository(pool);
  const client = ledgerClient();

  const deps = {
    createUser: createUserUseCase(repo),
    authUser: authUserUseCase(repo),
    listUsers: listUsersUseCase(repo),
    getUser: getUserUseCase(repo),
    updateUser: updateUserUseCase(repo),
    deleteUser: deleteUserUseCase({ usersRepository: repo, ledgerClient: client }),
  };

  await registerRoutes(app, deps);

  function verifyInternalJwt(token) {
    return jwt.verify(token, internalSecret);
  }

  await app.register(
    async (internalScope) => {
      await registerInternalRoutes(internalScope, {
        getUser: deps.getUser,
        verifyInternalJwt,
      });
    },
    { prefix: '/internal' },
  );

  app.addHook('onClose', async () => {
    await pool.end();
    await db.destroy();
  });

  await app.listen({ port, host: '0.0.0.0' });
  logger.info(`identity listening on ${port}`);
}

bootstrap().catch((e) => {
  logger.error(e);
  process.exit(1);
});
