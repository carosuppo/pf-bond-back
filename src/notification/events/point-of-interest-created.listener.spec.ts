import { Test, TestingModule } from '@nestjs/testing';

import { NotificationService } from '../notification.service';
import { PointOfInterestCreatedEvent } from './point-of-interest-created.event';
import { PointOfInterestCreatedListener } from './point-of-interest-created.listener';

describe('PointOfInterestCreatedListener', () => {
  let listener: PointOfInterestCreatedListener;

  const repository = {
    findPointOfInterestNotificationContext: jest.fn(),
  };
  const notificationService = {
    sendToGroupExceptUser: jest.fn(),
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
    notificationService.sendToGroupExceptUser.mockResolvedValue(undefined);

    listener.onPointOfInterestCreated(
      new PointOfInterestCreatedEvent(3, 5, 'Colegio', 7),
    );
    await new Promise<void>((resolve) => setImmediate(resolve));

    expect(notificationService.sendToGroupExceptUser.mock.calls).toEqual([
      [
        3,
        7,
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
    notificationService.sendToGroupExceptUser.mockRejectedValue(
      new Error('Firebase temporalmente no disponible'),
    );

    listener.onPointOfInterestCreated(
      new PointOfInterestCreatedEvent(3, 5, 'Colegio', 7),
    );
    await new Promise<void>((resolve) => setImmediate(resolve));
    expect(notificationService.sendToGroupExceptUser.mock.calls).toHaveLength(
      1,
    );
  });
});
