export class GroupInboxNotificationResponseDto {
  id!: number;
  groupId!: number;
  groupName!: string;
  type!: string;
  title!: string;
  body!: string;
  data!: Record<string, string>;
  readAt!: Date | null;
  createdAt!: Date;
}
