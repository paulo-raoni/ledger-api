export function getBalanceUseCase(repo, snapshotRepo) {
  return async function execute(authUserId) {
    const snapshot = await snapshotRepo.getByUserId(authUserId);
    if (snapshot !== null) {
      return { amount: Number(snapshot.amount) };
    }
    const amount = await repo.getBalanceByUser({ user_id: authUserId });
    return { amount };
  };
}
