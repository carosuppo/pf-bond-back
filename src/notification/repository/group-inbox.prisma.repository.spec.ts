import { PrismaService } from '../../prisma/prisma.service';
import { GroupInboxPrismaRepository } from './group-inbox.prisma.repository';

describe('GroupInboxPrismaRepository', () => {
  const prisma = {
    groupInboxNotification: {
      createMany: jest.fn(),
      findMany: jest.fn(),
      updateMany: jest.fn(),
    },
  };
  let repository: GroupInboxPrismaRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repository = new GroupInboxPrismaRepository(
      prisma as unknown as PrismaService,
    );
  });

  it('persists notifications for the supplied group members', async () => {
    prisma.groupInboxNotification.createMany.mockResolvedValue({ count: 2 });

    await repository.createMany({
      recipientUserIds: [7, 8],
      groupId: 3,
      type: 'EVENT_UPDATED',
      title: 'Evento actualizado',
      body: 'Se modificó el evento.',
      data: { type: 'EVENT_UPDATED', groupId: '3' },
    });

    expect(prisma.groupInboxNotification.createMany).toHaveBeenCalledWith({
      data: [7, 8].map((recipientUserId) => ({
        recipientUserId,
        groupId: 3,
        type: 'EVENT_UPDATED',
        title: 'Evento actualizado',
        body: 'Se modificó el evento.',
        data: { type: 'EVENT_UPDATED', groupId: '3' },
      })),
    });
  });

  it('maps inbox records without exposing Prisma group objects', async () => {
    const createdAt = new Date('2026-10-09T10:00:00Z');
    prisma.groupInboxNotification.findMany.mockResolvedValue([
      {
        id: 1,
        groupId: 3,
        type: 'EVENT_REMINDER',
        title: 'Evento se acerca',
        body: 'Falta una hora.',
        data: { type: 'EVENT_REMINDER', groupId: '3' },
        readAt: null,
        createdAt,
        group: { name: 'Familia' },
      },
    ]);

    await expect(repository.findForUser(7)).resolves.toEqual([
      {
        id: 1,
        groupId: 3,
        groupName: 'Familia',
        type: 'EVENT_REMINDER',
        title: 'Evento se acerca',
        body: 'Falta una hora.',
        data: { type: 'EVENT_REMINDER', groupId: '3' },
        readAt: null,
        createdAt,
      },
    ]);

    expect(prisma.groupInboxNotification.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { recipientUserId: 7, group: { deletedAt: null } },
      }),
    );
  });

  it('marks read only for the notification recipient', async () => {
    prisma.groupInboxNotification.updateMany.mockResolvedValue({ count: 1 });

    await repository.markRead(7, 1);

    expect(prisma.groupInboxNotification.updateMany).toHaveBeenCalledWith({
      where: { id: 1, recipientUserId: 7, readAt: null },
      data: expect.objectContaining({ readAt: expect.any(Date) }),
    });
  });
});
