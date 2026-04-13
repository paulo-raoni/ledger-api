import { describe, test, expect, jest } from '@jest/globals';
import { makeIdempotencyHook } from '../../../http/hooks/idempotencyHook.js';

function makeRepo({ existing = null } = {}) {
  return {
    findByKeyAndUser: jest.fn(async () => existing),
    saveWithCTE: jest.fn(async () => ({})),
  };
}

function makeRequest({ key, userId = 'user-1' } = {}) {
  return {
    headers: key !== undefined ? { 'idempotency-key': key } : {},
    user: { sub: userId },
    idempotencyKey: undefined,
  };
}

function makeReply() {
  const hooks = [];
  const reply = {
    _status: 200,
    _body: null,
    status: jest.fn(function (code) {
      reply._status = code;
      return reply;
    }),
    send: jest.fn(function (body) {
      reply._body = body;
      return reply;
    }),
    addHook: jest.fn(function (_event, fn) {
      hooks.push(fn);
    }),
    _hooks: hooks,
  };
  return reply;
}

describe('idempotencyHook', () => {
  test('missing key: skips idempotency logic and proceeds normally', async () => {
    const repo = makeRepo();
    const hook = makeIdempotencyHook(repo);
    const request = makeRequest({ key: undefined });
    const reply = makeReply();

    const result = await hook(request, reply);

    expect(result).toBeUndefined();
    expect(repo.findByKeyAndUser).not.toHaveBeenCalled();
    expect(reply.status).not.toHaveBeenCalled();
    expect(reply.send).not.toHaveBeenCalled();
  });

  test('valid key format: passes validation and registers onSend hook', async () => {
    const repo = makeRepo({ existing: null });
    const hook = makeIdempotencyHook(repo);
    const request = makeRequest({ key: 'valid-key_123' });
    const reply = makeReply();

    await hook(request, reply);

    expect(repo.findByKeyAndUser).toHaveBeenCalledWith('valid-key_123', 'user-1');
    expect(request.idempotencyKey).toBe('valid-key_123');
    expect(reply.addHook).toHaveBeenCalledWith('onSend', expect.any(Function));
    expect(reply.send).not.toHaveBeenCalled();
  });

  test('invalid key format: returns 400', async () => {
    const repo = makeRepo();
    const hook = makeIdempotencyHook(repo);
    const request = makeRequest({ key: 'bad key with spaces!' });
    const reply = makeReply();

    await hook(request, reply);

    expect(reply.status).toHaveBeenCalledWith(400);
    expect(reply.send).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'BAD_REQUEST' }),
    );
    expect(repo.findByKeyAndUser).not.toHaveBeenCalled();
  });

  test('key too long (257 chars): returns 400', async () => {
    const repo = makeRepo();
    const hook = makeIdempotencyHook(repo);
    const request = makeRequest({ key: 'a'.repeat(257) });
    const reply = makeReply();

    await hook(request, reply);

    expect(reply.status).toHaveBeenCalledWith(400);
    expect(reply.send).toHaveBeenCalledWith(expect.objectContaining({ error: 'BAD_REQUEST' }));
  });

  test('duplicate key: returns cached response without calling repo.saveWithCTE', async () => {
    const cached = { response_status: 201, response_body: { id: 'tx-1', type: 'CREDIT' } };
    const repo = makeRepo({ existing: cached });
    const hook = makeIdempotencyHook(repo);
    const request = makeRequest({ key: 'dup-key' });
    const reply = makeReply();

    await hook(request, reply);

    expect(repo.findByKeyAndUser).toHaveBeenCalledWith('dup-key', 'user-1');
    expect(reply.status).toHaveBeenCalledWith(201);
    expect(reply.send).toHaveBeenCalledWith(cached.response_body);
    expect(repo.saveWithCTE).not.toHaveBeenCalled();
  });

  test('same key different users: separate lookups use respective user IDs', async () => {
    const repoUserA = makeRepo({ existing: null });
    const repoUserB = makeRepo({ existing: null });

    const hookA = makeIdempotencyHook(repoUserA);
    const hookB = makeIdempotencyHook(repoUserB);

    const requestA = makeRequest({ key: 'shared-key', userId: 'user-A' });
    const requestB = makeRequest({ key: 'shared-key', userId: 'user-B' });

    await hookA(requestA, makeReply());
    await hookB(requestB, makeReply());

    expect(repoUserA.findByKeyAndUser).toHaveBeenCalledWith('shared-key', 'user-A');
    expect(repoUserB.findByKeyAndUser).toHaveBeenCalledWith('shared-key', 'user-B');
  });

  test('onSend hook saves response to repo when key is new', async () => {
    const repo = makeRepo({ existing: null });
    const hook = makeIdempotencyHook(repo);
    const request = makeRequest({ key: 'new-key' });
    const reply = makeReply();

    await hook(request, reply);

    const onSendFn = reply._hooks[0];
    expect(onSendFn).toBeDefined();

    const fakeReply = { statusCode: 201 };
    const payload = JSON.stringify({ id: 'tx-99' });

    await onSendFn(request, fakeReply, payload);

    expect(repo.saveWithCTE).toHaveBeenCalledWith('new-key', 'user-1', 201, { id: 'tx-99' });
  });
});
