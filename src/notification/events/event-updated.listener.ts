import { Inject, Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

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
      const message =
        error instanceof Error ? error.message : 'Error desconocido';
      this.logger.error(
        `No se pudo enviar la notificación del evento ${event.eventId}: ${message}`,
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
      this.logger.warn(
        `No se encontró contexto para notificar el evento ${event.eventId}.`,
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
