import { Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { GroupEventService } from '../../group/group-event.service';
import { LocationService } from '../../location/location.service';
import { ILocationRepository } from '../../location/repository/location.repository.interface';
import { PointOfInterestPresenceService } from '../../point-of-interest/presence/point-of-interest-presence.service';
import { FirebasePushService } from '../firebase/firebase-push.service';
import { NotificationService } from '../notification.service';
import { IDevicePushTokenRepository } from '../repository/device-push-token.repository.interface';
import { PointOfInterestCreatedListener } from './point-of-interest-created.listener';
import { PointOfInterestEnteredEvent } from './point-of-interest-entered.event';
import { PointOfInterestExitedEvent } from './point-of-interest-exited.event';

describe('Movement notification pipeline', () => {
  const repository: jest.Mocked<IDevicePushTokenRepository> = {
    register: jest.fn(),
    unregister: jest.fn(),
    findByUserIds: jest.fn(),
    findActiveUserIdsByGroup: jest.fn(),
    findPointOfInterestNotificationContext: jest.fn(),
    deleteByTokens: jest.fn(),
  };
  const sendToTokens = jest.fn();
  const notifications = new NotificationService(repository, {
    sendToTokens,
  } as unknown as FirebasePushService);
  const listener = new PointOfInterestCreatedListener(
    repository,
    notifications,
  );
  beforeEach(() => {
    jest.clearAllMocks();
    repository.findPointOfInterestNotificationContext.mockResolvedValue({
      actorName: 'Thomas',
      groupName: 'Familia',
    });
    repository.findActiveUserIdsByGroup.mockResolvedValue([9]);
    repository.findByUserIds.mockResolvedValue([
      { userId: 9, token: 'receiver-phone' },
    ]);
    sendToTokens.mockResolvedValue({ invalidTokens: [] });
  });
  it.each([
    ['ENTERED', 'Ingreso a punto de interés', 'ingresó a'],
    ['EXITED', 'Egreso de punto de interés', 'salió de'],
  ])(
    'sends %s immediately with exact title/body and string data',
    async (type, title, action) => {
      if (type === 'ENTERED')
        listener.onPointOfInterestEntered(
          new PointOfInterestEnteredEvent(3, 8, 'Colegio', 7),
        );
      else
        listener.onPointOfInterestExited(
          new PointOfInterestExitedEvent(3, 8, 'Colegio', 7),
        );
      await new Promise<void>((resolve) => setImmediate(resolve));
      expect(repository.findActiveUserIdsByGroup.mock.calls).toContainEqual([
        3,
        7,
        'POINT_OF_INTEREST_' + type,
      ]);
      expect(sendToTokens).toHaveBeenCalledWith(['receiver-phone'], {
        title,
        body: 'Thomas ' + action + ' "Colegio" en el grupo Familia.',
        data: {
          type: 'POINT_OF_INTEREST_' + type,
          groupId: '3',
          pointOfInterestId: '8',
          memberUserId: '7',
        },
      });
    },
  );
  it('FCM rejection does not invalidate location or presence and produces a logged error', async () => {
    const log = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
    sendToTokens.mockRejectedValue(new Error('FCM offline'));
    const emitter = new EventEmitter2();
    emitter.on(
      'point-of-interest.entered',
      (event: PointOfInterestEnteredEvent) =>
        listener.onPointOfInterestEntered(event),
    );
    const save = jest.fn().mockResolvedValue(true);
    const presence = new PointOfInterestPresenceService(
      {
        findCandidates: jest.fn().mockResolvedValue([
          {
            memberId: 1,
            groupId: 3,
            pointOfInterestId: 8,
            name: 'Colegio',
            radius: 100,
            latitude: 0,
            longitude: 0,
            isInside: false,
          },
        ]),
        save,
      },
      emitter,
    );
    const location = { latitude: 0, longitude: 0 };
    const locations = {
      findSharingByUser: jest
        .fn()
        .mockResolvedValue([{ locationSharingEnabled: true }]),
      upsertCurrentLocation: jest.fn().mockResolvedValue(location),
    } as unknown as ILocationRepository;
    const service = new LocationService(
      locations,
      new GroupEventService(),
      presence,
    );
    await expect(service.updateCurrentLocation(7, location)).resolves.toEqual(
      location,
    );
    await new Promise<void>((resolve) => setImmediate(resolve));
    expect(save).toHaveBeenCalledTimes(1);
    expect(sendToTokens).toHaveBeenCalledTimes(1);
    expect(log).toHaveBeenCalled();
    log.mockRestore();
  });
  it('detection failure leaves successfully persisted location valid', async () => {
    const log = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
    const location = { latitude: 1, longitude: 2 };
    const upsertCurrentLocation = jest.fn().mockResolvedValue(location);
    const service = new LocationService(
      {
        findSharingByUser: jest
          .fn()
          .mockResolvedValue([{ locationSharingEnabled: true }]),
        upsertCurrentLocation,
      } as unknown as ILocationRepository,
      new GroupEventService(),
      {
        evaluate: jest
          .fn()
          .mockRejectedValue(new Error('database temporarily unavailable')),
      } as unknown as PointOfInterestPresenceService,
    );
    await expect(service.updateCurrentLocation(7, location)).resolves.toEqual(
      location,
    );
    expect(upsertCurrentLocation).toHaveBeenCalledTimes(1);
    expect(log).toHaveBeenCalled();
    log.mockRestore();
  });
});
