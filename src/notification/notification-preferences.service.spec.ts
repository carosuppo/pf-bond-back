import { ForbiddenException } from '@nestjs/common';
import { NotificationType } from '@prisma/client';
import { validate } from 'class-validator';
import { NotificationPreferencesService } from './notification-preferences.service';
import { INotificationPreferencesRepository } from './repository/notification-preferences.repository.interface';
import {
  UpdateNotificationPreferenceDto,
  UpdateNotificationTypePreferenceDto,
} from './dto/notification-preferences.dto';

describe('Notification preferences', () => {
  let repository: jest.Mocked<INotificationPreferencesRepository>;
  let service: NotificationPreferencesService;
  beforeEach(() => {
    repository = {
      find: jest.fn().mockResolvedValue({
        notificationsEnabled: true,
        members: [
          {
            id: 2,
            groupId: 3,
            group: { name: 'Familia' },
            notificationsEnabled: true,
            notificationPreferences: [],
          },
        ],
      }),
      updateGlobal: jest.fn(),
      updateGroup: jest.fn().mockResolvedValue(true),
      updateType: jest.fn().mockResolvedValue(true),
    };
    service = new NotificationPreferencesService(repository);
  });
  it('preserves default global/group true and enables absent type rows', async () => {
    const result = await service.get(7);
    expect(result.enabled).toBe(true);
    expect(result.groups[0].enabled).toBe(true);
    expect(Object.values(result.groups[0].types)).toEqual([
      true,
      true,
      true,
      true,
    ]);
  });
  it('an explicit false affects only its type', async () => {
    repository.find.mockResolvedValue({
      notificationsEnabled: false,
      members: [
        {
          id: 2,
          groupId: 3,
          group: { name: 'Familia' },
          notificationsEnabled: false,
          notificationPreferences: [
            {
              type: NotificationType.POINT_OF_INTEREST_ENTERED,
              enabled: false,
            },
          ],
        },
      ],
    });
    const result = await service.get(7);
    expect(result.enabled).toBe(false);
    expect(result.groups[0].types.POINT_OF_INTEREST_ENTERED).toBe(false);
    expect(result.groups[0].types.POINT_OF_INTEREST_EXITED).toBe(true);
  });
  it('returns no stale groups', async () => {
    repository.find.mockResolvedValue({
      notificationsEnabled: true,
      members: [],
    });
    expect((await service.get(7)).groups).toEqual([]);
  });
  it('updates global without removing device tokens or type preferences', async () => {
    await service.updateGlobal(7, false);
    expect(repository.updateGlobal.mock.calls).toContainEqual([7, false]);
    expect(repository.updateGroup.mock.calls).toHaveLength(0);
    expect(repository.updateType.mock.calls).toHaveLength(0);
  });
  it('rejects a foreign group for both group and type updates', async () => {
    repository.updateGroup.mockResolvedValue(false);
    repository.updateType.mockResolvedValue(false);
    await expect(service.updateGroup(7, 99, false)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    await expect(
      service.updateType(
        7,
        99,
        NotificationType.POINT_OF_INTEREST_ENTERED,
        false,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
  it('passes authenticated identity and type to persistence', async () => {
    await service.updateType(
      7,
      3,
      NotificationType.POINT_OF_INTEREST_ENTERED,
      false,
    );
    expect(repository.updateType.mock.calls).toContainEqual([
      7,
      3,
      NotificationType.POINT_OF_INTEREST_ENTERED,
      false,
    ]);
  });
  it('rejects non-boolean values and unknown types', async () => {
    expect(
      await validate(
        Object.assign(new UpdateNotificationPreferenceDto(), {
          enabled: 'false',
        }),
      ),
    ).not.toHaveLength(0);
    expect(
      await validate(
        Object.assign(new UpdateNotificationTypePreferenceDto(), {
          enabled: true,
          type: 'INVALID',
        }),
      ),
    ).not.toHaveLength(0);
  });
});
