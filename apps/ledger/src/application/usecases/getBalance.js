export function getBalanceUseCase(repo) {
  return async function execute(authUserId) {
    const amount = await repo.getBalanceByUser({ user_id: authUserId });
    return { amount };
  };
}
