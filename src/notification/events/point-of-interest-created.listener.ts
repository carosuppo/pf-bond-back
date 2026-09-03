import { Inject, Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

import { NotificationService } from '../notification.service';
import type { IDevicePushTokenRepository } from '../repository/device-push-token.repository.interface';
import {
  POINT_OF_INTEREST_CREATED_EVENT,
  PointOfInterestCreatedEvent,
} from './point-of-interest-created.event';
import {
  POINT_OF_INTEREST_UPDATED_EVENT,
  PointOfInterestUpdatedEvent,
} from './point-of-interest-updated.event';

type PointOfInterestNotificationEvent =
  PointOfInterestCreatedEvent | PointOfInterestUpdatedEvent;

interface PointOfInterestNotificationContent {
  title: string;
  action: string;
  type: 'POINT_OF_INTEREST_CREATED' | 'POINT_OF_INTEREST_UPDATED';
}

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
    this.handleSafely(event, {
      title: 'Nuevo punto de interés',
      action: 'agregó',
      type: 'POINT_OF_INTEREST_CREATED',
    });
  }

  @OnEvent(POINT_OF_INTEREST_UPDATED_EVENT)
  onPointOfInterestUpdated(event: PointOfInterestUpdatedEvent): void {
    this.handleSafely(event, {
      title: 'Punto de interés actualizado',
      action: 'modificó',
      type: 'POINT_OF_INTEREST_UPDATED',
    });
  }

  private handleSafely(
    event: PointOfInterestNotificationEvent,
    content: PointOfInterestNotificationContent,
  ): void {
    void this.handle(event, content).catch((error: unknown) => {
      const message =
        error instanceof Error ? error.message : 'Error desconocido';
      this.logger.error(
        `No se pudo enviar la notificación del POI ${event.pointOfInterestId}: ${message}`,
      );
    });
  }

  private async handle(
    event: PointOfInterestNotificationEvent,
    content: PointOfInterestNotificationContent,
  ): Promise<void> {
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
        title: content.title,
        body: `${context.actorName} ${content.action} "${event.pointOfInterestName}" ${content.type === 'POINT_OF_INTEREST_CREATED' ? 'al' : 'en el'} grupo ${context.groupName}.`,
        data: {
          type: content.type,
          groupId: String(event.groupId),
          pointOfInterestId: String(event.pointOfInterestId),
        },
      },
    );
  }
}
