import { NotificationType } from '@prisma/client';
import { Inject, Injectable } from '@nestjs/common';
import type { GroupInboxNotificationResponseDto } from './dto/group-inbox-notification-response.dto';

import {
  FirebasePushService,
  PushMessage,
} from './firebase/firebase-push.service';
import type { IDevicePushTokenRepository } from './repository/device-push-token.repository.interface';
import type { IGroupInboxRepository } from './repository/group-inbox.repository.interface';

@Injectable()
export class NotificationService {
  constructor(
    @Inject('devicePushTokenRepository')
    private readonly devicePushTokenRepository: IDevicePushTokenRepository,
    private readonly firebasePushService: FirebasePushService,
    @Inject('groupInboxRepository')
    private readonly groupInboxRepository: IGroupInboxRepository,
  ) {}

  async registerDeviceToken(
    userId: number,
    token: string,
    platform: string,
  ): Promise<void> {
    await this.devicePushTokenRepository.register(userId, token, platform);
  }

  async unregisterDeviceToken(userId: number, token: string): Promise<void> {
    await this.devicePushTokenRepository.unregister(userId, token);
  }

  async sendToUser(userId: number, message: PushMessage): Promise<void> {
    await this.sendToUsers([userId], message);
  }

  async sendToUsers(userIds: number[], message: PushMessage): Promise<void> {
    const uniqueUserIds = [...new Set(userIds)];
    const groupId = Number(message.data.groupId);
    const type = message.data.type;
    if (
      Number.isInteger(groupId) &&
      groupId > 0 &&
      type &&
      type !== 'GROUP_JOIN_REQUEST' &&
      type !== 'POINT_OF_INTEREST_ENTERED' &&
      type !== 'POINT_OF_INTEREST_EXITED'
    ) {
      await this.groupInboxRepository.createMany({
        recipientUserIds: uniqueUserIds,
        groupId,
        type,
        title: message.title,
        body: message.body,
        data: message.data,
      });
    }

    const records =
      await this.devicePushTokenRepository.findByUserIds(uniqueUserIds);
    const tokens = records.map((record) => record.token);
    if (tokens.length === 0) return;

    const result = await this.firebasePushService.sendToTokens(tokens, message);
    await this.devicePushTokenRepository.deleteByTokens(result.invalidTokens);
  }

  async getInbox(userId: number): Promise<GroupInboxNotificationResponseDto[]> {
    return this.groupInboxRepository.findForUser(userId);
  }

  async markInboxNotificationRead(
    userId: number,
    notificationId: number,
  ): Promise<void> {
    await this.groupInboxRepository.markRead(userId, notificationId);
  }

  async sendToGroup(groupId: number, message: PushMessage): Promise<void> {
    const userIds =
      await this.devicePushTokenRepository.findActiveUserIdsByGroup(groupId);
    await this.sendToUsers(userIds, message);
  }

  async sendToGroupExceptUserByType(
    groupId: number,
    excludedUserId: number,
    type: NotificationType,
    message: PushMessage,
  ): Promise<void> {
    const userIds =
      await this.devicePushTokenRepository.findActiveUserIdsByGroup(
        groupId,
        excludedUserId,
        type,
      );
    await this.sendToUsers(userIds, message);
  }

  async sendToGroupExceptUser(
    groupId: number,
    excludedUserId: number,
    message: PushMessage,
  ): Promise<void> {
    const userIds =
      await this.devicePushTokenRepository.findActiveUserIdsByGroup(
        groupId,
        excludedUserId,
      );
    await this.sendToUsers(userIds, message);
  }
}
