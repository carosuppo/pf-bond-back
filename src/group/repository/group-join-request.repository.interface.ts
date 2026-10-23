export interface GroupJoinRequestRecord {
  id: number;
  groupId: number;
  groupName: string;
  requesterUserId: number;
  requesterName: string;
  requesterProfilePhoto: string | null;
  requestedAt: Date;
}

export type GroupJoinRequestSubmission =
  | { status: 'created' | 'pending'; requestId: number }
  | { status: 'alreadyMember' };

export type GroupJoinRequestResolution =
  | {
      status: 'resolved';
      groupId: number;
      groupName: string;
      requesterUserId: number;
      requesterName: string;
    }
  | { status: 'notFound' }
  | { status: 'notPending' }
  | { status: 'forbidden' };

export interface IGroupJoinRequestRepository {
  submit(groupId: number, userId: number): Promise<GroupJoinRequestSubmission>;
  findPendingForAdmin(adminUserId: number): Promise<GroupJoinRequestRecord[]>;
  findAdminUserIds(groupId: number): Promise<number[]>;
  accept(
    requestId: number,
    adminUserId: number,
  ): Promise<GroupJoinRequestResolution>;
  reject(
    requestId: number,
    adminUserId: number,
  ): Promise<GroupJoinRequestResolution>;
}
