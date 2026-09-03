import { Inject, Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

import { NotificationService } from '../notification.service';
import type { IDevicePushTokenRepository } from '../repository/device-push-token.repository.interface';
import {
  POINT_OF_INTEREST_CREATED_EVENT,
  PointOfInterestCreatedEvent,
} from './point-of-interest-created.event';

@Injectable()
export class PointOfInterestCreatedListener {
  private readonly logger = new Logger(PointOfInterestCreatedListener.name);

  constructor(
    @Inject('devicePushTokenRepository')
    private readonly devicePushTokenRepository: IDevicePushTokenRepository,
    private readonly notificationService: NotificationService,
  ) {}

  @OnEvent(POINT_OF_INTEREST_CREATED_EVENT)
  onPointOfInterestCreated(event: PointOfInterestCreatedEvent): void {
    void this.handle(event).catch((error: unknown) => {
      const message =
        error instanceof Error ? error.message : 'Error desconocido';
      this.logger.error(
        `No se pudo enviar la notificación del POI ${event.pointOfInterestId}: ${message}`,
      );
    });
  }

  private async handle(event: PointOfInterestCreatedEvent): Promise<void> {
    const context =
      await this.devicePushTokenRepository.findPointOfInterestNotificationContext(
        event.groupId,
        event.actorUserId,
      );

    if (!context) {
      this.logger.warn(
        `No se encontró contexto para notificar el POI ${event.pointOfInterestId}.`,
      );
      return;
    }

    await this.notificationService.sendToGroupExceptUser(
      event.groupId,
      event.actorUserId,
      {
        title: 'Nuevo punto de interés',
        body: `${context.actorName} agregó "${event.pointOfInterestName}" al grupo ${context.groupName}.`,
        data: {
          type: 'POINT_OF_INTEREST_CREATED',
          groupId: String(event.groupId),
          pointOfInterestId: String(event.pointOfInterestId),
        },
      },
    );
  }
}
