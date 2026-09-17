export interface RemovedMembership {
  groupId: number;
  memberId: number;
}

export interface IAccountDeletionRepository {
  deleteAccount(userId: number): Promise<RemovedMembership[]>;
}
