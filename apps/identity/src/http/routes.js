export async function registerRoutes(app, deps) {
  const { createUser, authUser, listUsers, getUser, updateUser, deleteUser } = deps;

  app.post('/users', async (req, reply) => {
    const created = await createUser(req.body);
    return reply.send(created);
  });

  app.post('/auth', async (req, reply) => {
    const res = await authUser(req.body);
    return reply.send(res);
  });

  app.get('/users', async (_req, reply) => {
    const users = await listUsers();
    return reply.send(users);
  });

  app.get('/users/:id', async (req, reply) => {
    const user = await getUser(req.params);
    return reply.send(user);
  });

  app.patch('/users/:id', async (req, reply) => {
    const user = await updateUser(req.params, req.body);
    return reply.send(user);
  });

  app.delete('/users/:id', async (req, reply) => {
    await deleteUser(req.params);
    return reply.send({ ok: true });
  });
}
