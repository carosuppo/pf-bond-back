import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { NotificationType } from '@prisma/client';
import { NotificationPreferencesResponseDto } from './dto/notification-preferences.dto';
import type { INotificationPreferencesRepository } from './repository/notification-preferences.repository.interface';

@Injectable()
export class NotificationPreferencesService {
  constructor(
    @Inject('notificationPreferencesRepository')
    private readonly repository: INotificationPreferencesRepository,
  ) {}
  async get(userId: number): Promise<NotificationPreferencesResponseDto> {
    const record = await this.repository.find(userId);
    return {
      enabled: record.notificationsEnabled,
      groups: record.members.map((member) => ({
        groupId: member.groupId,
        groupName: member.group.name,
        enabled: member.notificationsEnabled,
        types: Object.fromEntries(
          Object.values(NotificationType).map((type) => [
            type,
            member.notificationPreferences.find(
              (preference) => preference.type === type,
            )?.enabled ?? true,
          ]),
        ) as Record<NotificationType, boolean>,
      })),
    };
  }
  async updateGlobal(userId: number, enabled: boolean) {
    await this.repository.updateGlobal(userId, enabled);
    return { enabled };
  }
  async updateGroup(userId: number, groupId: number, enabled: boolean) {
    if (!(await this.repository.updateGroup(userId, groupId, enabled)))
      throw new ForbiddenException('No perteneces a este grupo.');
    return { enabled };
  }
  async updateType(
    userId: number,
    groupId: number,
    type: NotificationType,
    enabled: boolean,
  ) {
    if (!(await this.repository.updateType(userId, groupId, type, enabled)))
      throw new ForbiddenException('No perteneces a este grupo.');
    return { type, enabled };
  }
}
