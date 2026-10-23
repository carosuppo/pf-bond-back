export class GroupJoinRequestResponseDto {
  id!: number;
  groupId!: number;
  groupName!: string;
  requesterUserId!: number;
  requesterName!: string;
  requesterProfilePhoto!: string | null;
  requestedAt!: Date;
}

export class GroupJoinRequestActionResponseDto {
  message!: string;
}
