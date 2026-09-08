import { NotificationType } from '@prisma/client';
import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';
import type {
  DevicePushTokenRecord,
  IDevicePushTokenRepository,
  PointOfInterestNotificationContext,
} from './device-push-token.repository.interface';

@Injectable()
export class PrismaDevicePushTokenRepository implements IDevicePushTokenRepository {
  constructor(private readonly prismaService: PrismaService) {}

  async register(
    userId: number,
    token: string,
    platform: string,
  ): Promise<void> {
    await this.prismaService.devicePushToken.upsert({
      where: { token },
      create: { userId, token, platform },
      update: { userId, platform },
    });
  }

  async unregister(userId: number, token: string): Promise<void> {
    await this.prismaService.devicePushToken.deleteMany({
      where: { userId, token },
    });
  }

  async findByUserIds(userIds: number[]): Promise<DevicePushTokenRecord[]> {
    if (userIds.length === 0) return [];

    return this.prismaService.devicePushToken.findMany({
      where: {
        userId: { in: userIds },
        user: { deletedAt: null, notificationsEnabled: true },
      },
      select: { token: true, userId: true },
    });
  }

  async findActiveUserIdsByGroup(
    groupId: number,
    excludedUserId?: number,
    type?: NotificationType,
  ): Promise<number[]> {
    const members = await this.prismaService.member.findMany({
      where: {
        groupId,
        notificationsEnabled: true,
        notificationPreferences: type
          ? { none: { type, enabled: false } }
          : undefined,
        userId:
          excludedUserId === undefined ? undefined : { not: excludedUserId },
        group: { deletedAt: null },
        user: { deletedAt: null, notificationsEnabled: true },
      },
      select: { userId: true },
    });

    return members.map((member) => member.userId);
  }

  async findPointOfInterestNotificationContext(
    groupId: number,
    actorUserId: number,
  ): Promise<PointOfInterestNotificationContext | null> {
    const membership = await this.prismaService.member.findFirst({
      where: {
        groupId,
        userId: actorUserId,
        group: { deletedAt: null },
        user: { deletedAt: null },
      },
      select: {
        group: { select: { name: true } },
        user: { select: { name: true } },
      },
    });

    return membership
      ? { groupName: membership.group.name, actorName: membership.user.name }
      : null;
  }

  async deleteByTokens(tokens: string[]): Promise<void> {
    if (tokens.length === 0) return;

    await this.prismaService.devicePushToken.deleteMany({
      where: { token: { in: tokens } },
    });
  }
}
