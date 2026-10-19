import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreateGroupInboxNotification,
  GroupInboxNotificationRecord,
  IGroupInboxRepository,
} from './group-inbox.repository.interface';

@Injectable()
export class GroupInboxPrismaRepository implements IGroupInboxRepository {
  constructor(private readonly prisma: PrismaService) {}

  async createMany(notification: CreateGroupInboxNotification): Promise<void> {
    if (notification.recipientUserIds.length === 0) return;

    await this.prisma.groupInboxNotification.createMany({
      data: notification.recipientUserIds.map((recipientUserId) => ({
        recipientUserId,
        groupId: notification.groupId,
        type: notification.type,
        title: notification.title,
        body: notification.body,
        data: notification.data,
      })),
    });
  }

  async findForUser(userId: number): Promise<GroupInboxNotificationRecord[]> {
    const notifications = await this.prisma.groupInboxNotification.findMany({
      where: { recipientUserId: userId, group: { deletedAt: null } },
      include: { group: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
    });

    return notifications.map((notification) => ({
      id: notification.id,
      groupId: notification.groupId,
      groupName: notification.group.name,
      type: notification.type,
      title: notification.title,
      body: notification.body,
      data: this.toStringRecord(notification.data),
      readAt: notification.readAt,
      createdAt: notification.createdAt,
    }));
  }

  async markRead(userId: number, notificationId: number): Promise<void> {
    await this.prisma.groupInboxNotification.updateMany({
      where: { id: notificationId, recipientUserId: userId, readAt: null },
      data: { readAt: new Date() },
    });
  }

  private toStringRecord(value: Prisma.JsonValue): Record<string, string> {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      return {};
    }
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, String(item)]),
    );
  }
}
