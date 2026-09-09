export interface GetMemberInfoEntity {
  memberId: number;
  groupId: number;
  name: string;
  lastSeenAt: Date | null;
}
