export interface GetMemberInfoEntity {
  memberId: number;
  groupId: number;
  name: string;
  profilePhoto: string | null;
  lastSeenAt: Date | null;
}
