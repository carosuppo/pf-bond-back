import { Injectable } from '@nestjs/common';
import { NotificationType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { INotificationPreferencesRepository } from './notification-preferences.repository.interface';

@Injectable()
export class PrismaNotificationPreferencesRepository implements INotificationPreferencesRepository {
  constructor(private readonly prisma: PrismaService) {}
  find(userId: number) {
    return this.prisma.user.findUniqueOrThrow({
      where: { id: userId, deletedAt: null },
      select: {
        notificationsEnabled: true,
        members: {
          where: { group: { deletedAt: null } },
          orderBy: { group: { name: 'asc' } },
          select: {
            id: true,
            groupId: true,
            notificationsEnabled: true,
            group: { select: { name: true } },
            notificationPreferences: { select: { type: true, enabled: true } },
          },
        },
      },
    });
  }
  async updateGlobal(userId: number, enabled: boolean): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId, deletedAt: null },
      data: { notificationsEnabled: enabled },
    });
  }
  async updateGroup(
    userId: number,
    groupId: number,
    enabled: boolean,
  ): Promise<boolean> {
    const result = await this.prisma.member.updateMany({
      where: {
        userId,
        groupId,
        group: { deletedAt: null },
        user: { deletedAt: null },
      },
      data: { notificationsEnabled: enabled },
    });
    return result.count > 0;
  }
  async updateType(
    userId: number,
    groupId: number,
    type: NotificationType,
    enabled: boolean,
  ): Promise<boolean> {
    return this.prisma.$transaction(async (tx) => {
      const member = await tx.member.findFirst({
        where: {
          userId,
          groupId,
          group: { deletedAt: null },
          user: { deletedAt: null },
        },
        select: { id: true },
      });
      if (!member) return false;
      await tx.memberNotificationPreference.upsert({
        where: { memberId_type: { memberId: member.id, type } },
        create: { memberId: member.id, type, enabled },
        update: { enabled },
      });
      return true;
    });
  }
}
