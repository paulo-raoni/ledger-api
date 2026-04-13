export function listUsersUseCase(repo) {
  return async () => repo.list();
}
