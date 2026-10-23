import { Inject, Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { logErrorSafely, logSafely } from '../../common/logging/error-logging';

import { NotificationService } from '../notification.service';
import type { IDevicePushTokenRepository } from '../repository/device-push-token.repository.interface';
import { EVENT_UPDATED_EVENT, EventUpdatedEvent } from './event-updated.event';

@Injectable()
export class EventUpdatedListener {
  private readonly logger = new Logger(EventUpdatedListener.name);

  constructor(
    @Inject('devicePushTokenRepository')
    private readonly devicePushTokenRepository: IDevicePushTokenRepository,
    private readonly notificationService: NotificationService,
  ) {}

  @OnEvent(EVENT_UPDATED_EVENT)
  onEventUpdated(event: EventUpdatedEvent): void {
    void this.handle(event).catch((error: unknown) => {
      logErrorSafely(
        this.logger,
        'operation=sendEventUpdatedNotification outcome=error',
        error,
      );
    });
  }

  private async handle(event: EventUpdatedEvent): Promise<void> {
    const context =
      await this.devicePushTokenRepository.findEventNotificationContext(
        event.groupId,
        event.actorUserId,
      );

    if (!context) {
      logSafely(
        this.logger,
        'warn',
        'operation=resolveEventNotificationContext outcome=notFound',
      );
      return;
    }

    await this.notificationService.sendToGroupExceptUserByType(
      event.groupId,
      event.actorUserId,
      'EVENT_UPDATED',
      {
        title: 'Evento actualizado',
        body: `${context.actorName} modificó "${event.eventName}" en el grupo ${context.groupName}.`,
        data: {
          type: 'EVENT_UPDATED',
          groupId: String(event.groupId),
          eventId: String(event.eventId),
        },
      },
    );
  }
}
