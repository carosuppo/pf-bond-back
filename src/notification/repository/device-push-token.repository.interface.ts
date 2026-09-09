import { NotificationType } from '@prisma/client';
export interface DevicePushTokenRecord {
  token: string;
  userId: number;
}

export interface PointOfInterestNotificationContext {
  groupName: string;
  actorName: string;
}

export interface IDevicePushTokenRepository {
  register(userId: number, token: string, platform: string): Promise<void>;
  unregister(userId: number, token: string): Promise<void>;
  findByUserIds(userIds: number[]): Promise<DevicePushTokenRecord[]>;
  findActiveUserIdsByGroup(
    groupId: number,
    excludedUserId?: number,
    type?: NotificationType,
  ): Promise<number[]>;
  findPointOfInterestNotificationContext(
    groupId: number,
    actorUserId: number,
  ): Promise<PointOfInterestNotificationContext | null>;
  deleteByTokens(tokens: string[]): Promise<void>;
}
