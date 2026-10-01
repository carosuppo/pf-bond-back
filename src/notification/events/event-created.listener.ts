import { Inject, Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

import { NotificationService } from '../notification.service';
import type { IDevicePushTokenRepository } from '../repository/device-push-token.repository.interface';
import { EVENT_CREATED_EVENT, EventCreatedEvent } from './event-created.event';

@Injectable()
export class EventCreatedListener {
  private readonly logger = new Logger(EventCreatedListener.name);

  constructor(
    @Inject('devicePushTokenRepository')
    private readonly devicePushTokenRepository: IDevicePushTokenRepository,
    private readonly notificationService: NotificationService,
  ) {}

  @OnEvent(EVENT_CREATED_EVENT)
  onEventCreated(event: EventCreatedEvent): void {
    void this.handle(event).catch((error: unknown) => {
      const message =
        error instanceof Error ? error.message : 'Error desconocido';
      this.logger.error(
        `No se pudo enviar la notificación del evento ${event.eventId}: ${message}`,
      );
    });
  }

  private async handle(event: EventCreatedEvent): Promise<void> {
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
      'EVENT_CREATED',
      {
        title: 'Nuevo evento',
        body: `${context.actorName} creó "${event.eventName}" en el grupo ${context.groupName}.`,
        data: {
          type: 'EVENT_CREATED',
          groupId: String(event.groupId),
          eventId: String(event.eventId),
        },
      },
    );
  }
}
