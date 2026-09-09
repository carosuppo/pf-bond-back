import { Test, TestingModule } from '@nestjs/testing';

import { NotificationService } from '../notification.service';
import { PointOfInterestCreatedEvent } from './point-of-interest-created.event';
import { PointOfInterestCreatedListener } from './point-of-interest-created.listener';
import { PointOfInterestUpdatedEvent } from './point-of-interest-updated.event';

describe('PointOfInterestCreatedListener', () => {
  let listener: PointOfInterestCreatedListener;

  const repository = {
    findPointOfInterestNotificationContext: jest.fn(),
  };
  const notificationService = {
    sendToGroupExceptUserByType: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    repository.findPointOfInterestNotificationContext.mockResolvedValue({
      actorName: 'Thomas',
      groupName: 'Familia',
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PointOfInterestCreatedListener,
        { provide: 'devicePushTokenRepository', useValue: repository },
        { provide: NotificationService, useValue: notificationService },
      ],
    }).compile();

    listener = module.get(PointOfInterestCreatedListener);
  });

  it('excluye al creador y construye data de FCM únicamente con strings', async () => {
    notificationService.sendToGroupExceptUserByType.mockResolvedValue(
      undefined,
    );

    listener.onPointOfInterestCreated(
      new PointOfInterestCreatedEvent(3, 5, 'Colegio', 7),
    );
    await new Promise<void>((resolve) => setImmediate(resolve));

    expect(notificationService.sendToGroupExceptUserByType.mock.calls).toEqual([
      [
        3,
        7,
        'POINT_OF_INTEREST_CREATED',
        {
          title: 'Nuevo punto de interés',
          body: 'Thomas agregó "Colegio" al grupo Familia.',
          data: {
            type: 'POINT_OF_INTEREST_CREATED',
            groupId: '3',
            pointOfInterestId: '5',
          },
        },
      ],
    ]);
  });

  it('absorbe fallos de Firebase para que el evento no falle', async () => {
    notificationService.sendToGroupExceptUserByType.mockRejectedValue(
      new Error('Firebase temporalmente no disponible'),
    );

    listener.onPointOfInterestCreated(
      new PointOfInterestCreatedEvent(3, 5, 'Colegio', 7),
    );
    await new Promise<void>((resolve) => setImmediate(resolve));
    expect(
      notificationService.sendToGroupExceptUserByType.mock.calls,
    ).toHaveLength(1);
  });

  it('notifica una actualización con el nombre resultante y excluye al actor', async () => {
    notificationService.sendToGroupExceptUserByType.mockResolvedValue(
      undefined,
    );

    listener.onPointOfInterestUpdated(
      new PointOfInterestUpdatedEvent(3, 5, 'Colegio', 7),
    );
    await new Promise<void>((resolve) => setImmediate(resolve));

    expect(notificationService.sendToGroupExceptUserByType.mock.calls).toEqual([
      [
        3,
        7,
        'POINT_OF_INTEREST_UPDATED',
        {
          title: 'Punto de interés actualizado',
          body: 'Thomas modificó "Colegio" en el grupo Familia.',
          data: {
            type: 'POINT_OF_INTEREST_UPDATED',
            groupId: '3',
            pointOfInterestId: '5',
          },
        },
      ],
    ]);
  });

  it('no falla si una actualización no tiene contexto de destinatarios', async () => {
    repository.findPointOfInterestNotificationContext.mockResolvedValue(null);

    listener.onPointOfInterestUpdated(
      new PointOfInterestUpdatedEvent(3, 5, 'Colegio', 7),
    );
    await new Promise<void>((resolve) => setImmediate(resolve));

    expect(
      notificationService.sendToGroupExceptUserByType.mock.calls,
    ).toHaveLength(0);
  });

  it('absorbe fallos de Firebase al notificar una actualización', async () => {
    notificationService.sendToGroupExceptUserByType.mockRejectedValue(
      new Error('Firebase temporalmente no disponible'),
    );

    expect(() =>
      listener.onPointOfInterestUpdated(
        new PointOfInterestUpdatedEvent(3, 5, 'Colegio', 7),
      ),
    ).not.toThrow();
    await new Promise<void>((resolve) => setImmediate(resolve));

    expect(
      notificationService.sendToGroupExceptUserByType.mock.calls,
    ).toHaveLength(1);
  });
});
