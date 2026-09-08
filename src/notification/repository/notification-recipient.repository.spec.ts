import { NotificationType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { PrismaDevicePushTokenRepository } from './prisma-device-push-token.repository';
import { PrismaNotificationPreferencesRepository } from './prisma-notification-preferences.repository';

describe('Notification recipient persistence', () => {
  const findMany = jest.fn().mockResolvedValue([]);
  const tokenFindMany = jest.fn().mockResolvedValue([]);
  const userFind = jest.fn<Promise<unknown>, [unknown]>();
  const upsert = jest.fn();
  const memberFind = jest.fn();
  const tx = {
    member: { findFirst: memberFind },
    memberNotificationPreference: { upsert },
  };
  const prisma = {
    member: { findMany },
    devicePushToken: { findMany: tokenFindMany },
    user: { findUniqueOrThrow: userFind },
    $transaction: (work: (value: typeof tx) => Promise<unknown>) => work(tx),
  } as unknown as PrismaService;
  beforeEach(() => jest.clearAllMocks());
  it.each(Object.values(NotificationType))(
    'filters current members, actor and all preference layers for %s',
    async (type) => {
      const repository = new PrismaDevicePushTokenRepository(prisma);
      await repository.findActiveUserIdsByGroup(3, 7, type);
      expect(findMany).toHaveBeenCalledWith({
        where: {
          groupId: 3,
          userId: { not: 7 },
          group: { deletedAt: null },
          user: { deletedAt: null, notificationsEnabled: true },
          notificationsEnabled: true,
          notificationPreferences: { none: { type, enabled: false } },
        },
        select: { userId: true },
      });
    },
  );
  it('also checks global preference and active user at device lookup', async () => {
    await new PrismaDevicePushTokenRepository(prisma).findByUserIds([7, 8]);
    expect(tokenFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId: { in: [7, 8] },
          user: { deletedAt: null, notificationsEnabled: true },
        },
      }),
    );
  });
  it('loads only memberships of active groups', async () => {
    await new PrismaNotificationPreferencesRepository(prisma).find(7);
    expect(userFind.mock.calls[0][0]).toMatchObject({
      where: { id: 7, deletedAt: null },
      select: { members: { where: { group: { deletedAt: null } } } },
    });
  });
  it('upserts a type only after checking current membership', async () => {
    const repository = new PrismaNotificationPreferencesRepository(prisma);
    memberFind.mockResolvedValue(null);
    expect(
      await repository.updateType(
        7,
        3,
        NotificationType.POINT_OF_INTEREST_ENTERED,
        false,
      ),
    ).toBe(false);
    expect(upsert).not.toHaveBeenCalled();
    memberFind.mockResolvedValue({ id: 2 });
    expect(
      await repository.updateType(
        7,
        3,
        NotificationType.POINT_OF_INTEREST_ENTERED,
        false,
      ),
    ).toBe(true);
    expect(upsert).toHaveBeenCalledWith({
      where: {
        memberId_type: { memberId: 2, type: 'POINT_OF_INTEREST_ENTERED' },
      },
      create: {
        memberId: 2,
        type: 'POINT_OF_INTEREST_ENTERED',
        enabled: false,
      },
      update: { enabled: false },
    });
  });
});
