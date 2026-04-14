import { describe, test, expect, jest } from '@jest/globals';
import { registerIdempotency } from '../../../http/hooks/idempotencyHook.js';

function makeRepo({ existing = null } = {}) {
  return {
    findByKeyAndUser: jest.fn(async () => existing),
    saveWithCTE: jest.fn(async () => ({})),
  };
}

function makeFastify() {
  const hooks = { preHandler: [], onSend: [] };
  return {
    addHook: jest.fn((event, fn) => {
      if (!hooks[event]) hooks[event] = [];
      hooks[event].push(fn);
    }),
    _hooks: hooks,
  };
}

function makeRequest({ key, userId = 'user-1' } = {}) {
  return {
    headers: key !== undefined ? { 'idempotency-key': key } : {},
    user: { sub: userId },
    log: { error: jest.fn() },
  };
}

function makeReply() {
  const reply = {
    _status: 200,
    _body: null,
    statusCode: 200,
    status: jest.fn(function (code) {
      reply._status = code;
      reply.statusCode = code;
      return reply;
    }),
    send: jest.fn(function (body) {
      reply._body = body;
      return reply;
    }),
  };
  return reply;
}

async function runPreHandler(fastify, request, reply) {
  for (const fn of fastify._hooks.preHandler) {
    await fn(request, reply);
  }
}

async function runOnSend(fastify, request, reply, payload) {
  let current = payload;
  for (const fn of fastify._hooks.onSend) {
    const next = await fn(request, reply, current);
    if (next !== undefined) current = next;
  }
  return current;
}

describe('registerIdempotency', () => {
  test('missing key: skips idempotency logic and proceeds normally', async () => {
    const repo = makeRepo();
    const fastify = makeFastify();
    await registerIdempotency(fastify, { idempotencyRepo: repo });

    const request = makeRequest({ key: undefined });
    const reply = makeReply();

    await runPreHandler(fastify, request, reply);

    expect(repo.findByKeyAndUser).not.toHaveBeenCalled();
    expect(reply.status).not.toHaveBeenCalled();
    expect(reply.send).not.toHaveBeenCalled();
    expect(request.idempotencyKey).toBeUndefined();
  });

  test('valid key format: passes validation and attaches request state', async () => {
    const repo = makeRepo({ existing: null });
    const fastify = makeFastify();
    await registerIdempotency(fastify, { idempotencyRepo: repo });

    const request = makeRequest({ key: 'valid-key_123' });
    const reply = makeReply();

    await runPreHandler(fastify, request, reply);

    expect(repo.findByKeyAndUser).toHaveBeenCalledWith('valid-key_123', 'user-1');
    expect(request.idempotencyKey).toBe('valid-key_123');
    expect(request.idempotencyUserId).toBe('user-1');
    expect(request.idempotencySavedInTx).toBe(false);
    expect(reply.send).not.toHaveBeenCalled();
  });

  test('invalid key format: returns 400', async () => {
    const repo = makeRepo();
    const fastify = makeFastify();
    await registerIdempotency(fastify, { idempotencyRepo: repo });

    const request = makeRequest({ key: 'bad key with spaces!' });
    const reply = makeReply();

    await runPreHandler(fastify, request, reply);

    expect(reply.status).toHaveBeenCalledWith(400);
    expect(reply.send).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'BAD_REQUEST' }),
    );
    expect(repo.findByKeyAndUser).not.toHaveBeenCalled();
  });

  test('key too long (257 chars): returns 400', async () => {
    const repo = makeRepo();
    const fastify = makeFastify();
    await registerIdempotency(fastify, { idempotencyRepo: repo });

    const request = makeRequest({ key: 'a'.repeat(257) });
    const reply = makeReply();

    await runPreHandler(fastify, request, reply);

    expect(reply.status).toHaveBeenCalledWith(400);
    expect(reply.send).toHaveBeenCalledWith(expect.objectContaining({ error: 'BAD_REQUEST' }));
  });

  test('duplicate key: returns cached response without calling saveWithCTE', async () => {
    const cached = { response_status: 201, response_body: { id: 'tx-1', type: 'CREDIT' } };
    const repo = makeRepo({ existing: cached });
    const fastify = makeFastify();
    await registerIdempotency(fastify, { idempotencyRepo: repo });

    const request = makeRequest({ key: 'dup-key' });
    const reply = makeReply();

    await runPreHandler(fastify, request, reply);

    expect(repo.findByKeyAndUser).toHaveBeenCalledWith('dup-key', 'user-1');
    expect(reply.status).toHaveBeenCalledWith(201);
    expect(reply.send).toHaveBeenCalledWith(cached.response_body);
    expect(repo.saveWithCTE).not.toHaveBeenCalled();
  });

  test('same key different users: separate lookups use respective user IDs', async () => {
    const repoA = makeRepo({ existing: null });
    const repoB = makeRepo({ existing: null });
    const fastifyA = makeFastify();
    const fastifyB = makeFastify();
    await registerIdempotency(fastifyA, { idempotencyRepo: repoA });
    await registerIdempotency(fastifyB, { idempotencyRepo: repoB });

    const requestA = makeRequest({ key: 'shared-key', userId: 'user-A' });
    const requestB = makeRequest({ key: 'shared-key', userId: 'user-B' });

    await runPreHandler(fastifyA, requestA, makeReply());
    await runPreHandler(fastifyB, requestB, makeReply());

    expect(repoA.findByKeyAndUser).toHaveBeenCalledWith('shared-key', 'user-A');
    expect(repoB.findByKeyAndUser).toHaveBeenCalledWith('shared-key', 'user-B');
  });

  test('onSend hook saves response to repo when key is new', async () => {
    const repo = makeRepo({ existing: null });
    const fastify = makeFastify();
    await registerIdempotency(fastify, { idempotencyRepo: repo });

    const request = makeRequest({ key: 'new-key' });
    const reply = makeReply();

    await runPreHandler(fastify, request, reply);

    reply.statusCode = 201;
    const payload = JSON.stringify({ id: 'tx-99' });
    await runOnSend(fastify, request, reply, payload);

    expect(repo.saveWithCTE).toHaveBeenCalledWith('new-key', 'user-1', 201, { id: 'tx-99' });
  });

  test('onSend hook skips save when request.idempotencySavedInTx is true', async () => {
    const repo = makeRepo({ existing: null });
    const fastify = makeFastify();
    await registerIdempotency(fastify, { idempotencyRepo: repo });

    const request = makeRequest({ key: 'new-key' });
    const reply = makeReply();
    await runPreHandler(fastify, request, reply);

    request.idempotencySavedInTx = true;
    reply.statusCode = 201;
    await runOnSend(fastify, request, reply, JSON.stringify({ id: 'tx-1' }));

    expect(repo.saveWithCTE).not.toHaveBeenCalled();
  });

  test('onSend hook does nothing when no idempotency key on request', async () => {
    const repo = makeRepo();
    const fastify = makeFastify();
    await registerIdempotency(fastify, { idempotencyRepo: repo });

    const request = makeRequest({ key: undefined });
    const reply = makeReply();
    await runPreHandler(fastify, request, reply);

    reply.statusCode = 200;
    await runOnSend(fastify, request, reply, JSON.stringify({ ok: true }));

    expect(repo.saveWithCTE).not.toHaveBeenCalled();
  });
});
