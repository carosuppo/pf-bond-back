export interface CreateGroupInboxNotification {
  recipientUserIds: number[];
  groupId: number;
  type: string;
  title: string;
  body: string;
  data: Record<string, string>;
}

export interface GroupInboxNotificationRecord {
  id: number;
  groupId: number;
  groupName: string;
  type: string;
  title: string;
  body: string;
  data: Record<string, string>;
  readAt: Date | null;
  createdAt: Date;
}

export interface IGroupInboxRepository {
  createMany(notification: CreateGroupInboxNotification): Promise<void>;
  findForUser(userId: number): Promise<GroupInboxNotificationRecord[]>;
  markRead(userId: number, notificationId: number): Promise<void>;
}
