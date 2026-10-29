export interface BlockedUserRecord {
  userId: number;
  name: string;
  profilePhoto: string | null;
  blockedAt: Date;
}

export interface IUserBlockRepository {
  block(blockerUserId: number, blockedUserId: number): Promise<void>;
  unblock(blockerUserId: number, blockedUserId: number): Promise<void>;
  findBlockedUsers(blockerUserId: number): Promise<BlockedUserRecord[]>;
  findMutuallyBlockedUserIds(userId: number): Promise<number[]>;
  hasDirectionalBlock(
    blockerUserId: number,
    blockedUserId: number,
  ): Promise<boolean>;
  hasBlockBetween(firstUserId: number, secondUserId: number): Promise<boolean>;
  hasBlockedMemberInGroup(userId: number, groupId: number): Promise<boolean>;
}
