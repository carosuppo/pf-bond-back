import { NotificationType } from '@prisma/client';
import { Inject, Injectable } from '@nestjs/common';

import {
  FirebasePushService,
  PushMessage,
} from './firebase/firebase-push.service';
import type { IDevicePushTokenRepository } from './repository/device-push-token.repository.interface';

@Injectable()
export class NotificationService {
  constructor(
    @Inject('devicePushTokenRepository')
    private readonly devicePushTokenRepository: IDevicePushTokenRepository,
    private readonly firebasePushService: FirebasePushService,
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
    const records =
      await this.devicePushTokenRepository.findByUserIds(uniqueUserIds);
    const tokens = records.map((record) => record.token);
    if (tokens.length === 0) return;

    const result = await this.firebasePushService.sendToTokens(tokens, message);
    await this.devicePushTokenRepository.deleteByTokens(result.invalidTokens);
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
