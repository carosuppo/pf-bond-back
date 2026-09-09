import { NotificationType } from '@prisma/client';

export interface NotificationPreferencesRecord {
  notificationsEnabled: boolean;
  members: {
    id: number;
    groupId: number;
    notificationsEnabled: boolean;
    group: { name: string };
    notificationPreferences: { type: NotificationType; enabled: boolean }[];
  }[];
}
export interface INotificationPreferencesRepository {
  find(userId: number): Promise<NotificationPreferencesRecord>;
  updateGlobal(userId: number, enabled: boolean): Promise<void>;
  updateGroup(
    userId: number,
    groupId: number,
    enabled: boolean,
  ): Promise<boolean>;
  updateType(
    userId: number,
    groupId: number,
    type: NotificationType,
    enabled: boolean,
  ): Promise<boolean>;
}
