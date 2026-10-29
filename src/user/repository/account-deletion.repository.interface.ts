export interface RemovedMembership {
  groupId: number;
  memberId: number;
}

export interface IAccountDeletionRepository {
  deleteAccount(userId: number): Promise<RemovedMembership[]>;
  createDeletionRequest(
    userId: number,
    tokenHash: string,
    expiresAt: Date,
    requestedAt: Date,
    cooldownStartedAt: Date,
  ): Promise<boolean>;
  cancelDeletionRequest(userId: number, tokenHash: string): Promise<void>;
  consumeDeletionRequest(tokenHash: string, now: Date): Promise<number | null>;
  findExpiredUnverifiedUserIds(
    now: Date,
    createdBefore: Date,
  ): Promise<number[]>;
  deleteExpiredDeletionRequests(now: Date): Promise<void>;
}
