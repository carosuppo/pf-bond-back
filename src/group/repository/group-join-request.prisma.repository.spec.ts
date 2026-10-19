import { GroupJoinRequestStatus, RoleEnum } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { GroupJoinRequestPrismaRepository } from './group-join-request.prisma.repository';

describe('GroupJoinRequestPrismaRepository', () => {
  const transaction = {
    member: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    groupJoinRequest: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
  };
  const prisma = {
    $transaction: jest.fn((operation: (tx: typeof transaction) => unknown) =>
      operation(transaction),
    ),
    member: {
      findMany: jest.fn(),
    },
    groupJoinRequest: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
  };
  let repository: GroupJoinRequestPrismaRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repository = new GroupJoinRequestPrismaRepository(
      prisma as unknown as PrismaService,
    );
  });

  it('returns a pending request without inserting another record', async () => {
    transaction.member.findFirst.mockResolvedValue(null);
    transaction.groupJoinRequest.findUnique.mockResolvedValue({
      id: 22,
      status: GroupJoinRequestStatus.PENDING,
    });

    await expect(repository.submit(1, 7)).resolves.toEqual({
      status: 'pending',
      requestId: 22,
    });

    expect(transaction.groupJoinRequest.create).not.toHaveBeenCalled();
    expect(transaction.groupJoinRequest.update).not.toHaveBeenCalled();
  });

  it('does not create a request for an existing member', async () => {
    transaction.member.findFirst.mockResolvedValue({ id: 10 });

    await expect(repository.submit(1, 7)).resolves.toEqual({
      status: 'alreadyMember',
    });

    expect(transaction.groupJoinRequest.findUnique).not.toHaveBeenCalled();
  });

  it('reopens a rejected request instead of creating a duplicate', async () => {
    transaction.member.findFirst.mockResolvedValue(null);
    transaction.groupJoinRequest.findUnique.mockResolvedValue({
      id: 22,
      status: GroupJoinRequestStatus.REJECTED,
    });
    transaction.groupJoinRequest.updateMany.mockResolvedValue({ count: 1 });

    await expect(repository.submit(1, 7)).resolves.toEqual({
      status: 'created',
      requestId: 22,
    });

    expect(transaction.groupJoinRequest.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: 22,
          status: { not: GroupJoinRequestStatus.PENDING },
        },
        data: expect.objectContaining({
          status: GroupJoinRequestStatus.PENDING,
          resolvedAt: null,
        }),
      }),
    );
  });

  it('limits the pending request inbox to administrators', async () => {
    prisma.groupJoinRequest.findMany.mockResolvedValue([
      {
        id: 22,
        groupId: 1,
        requestedAt: new Date('2026-10-09T10:00:00Z'),
        group: { name: 'Familia' },
        user: { id: 7, name: 'Ana', profilePhoto: 'photo.png' },
      },
    ]);

    await expect(repository.findPendingForAdmin(8)).resolves.toEqual([
      {
        id: 22,
        groupId: 1,
        groupName: 'Familia',
        requesterUserId: 7,
        requesterName: 'Ana',
        requesterProfilePhoto: 'photo.png',
        requestedAt: new Date('2026-10-09T10:00:00Z'),
      },
    ]);

    expect(prisma.groupJoinRequest.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: GroupJoinRequestStatus.PENDING,
          group: expect.objectContaining({
            members: {
              some: { userId: 8, role: RoleEnum.ADMIN },
            },
          }),
        }),
      }),
    );
  });

  it('creates membership only after an administrator accepts', async () => {
    transaction.groupJoinRequest.findUnique.mockResolvedValue({
      id: 22,
      groupId: 1,
      userId: 7,
      status: GroupJoinRequestStatus.PENDING,
      group: { id: 1, name: 'Familia', deletedAt: null },
      user: { id: 7, name: 'Ana' },
    });
    transaction.member.findFirst
      .mockResolvedValueOnce({ id: 8 })
      .mockResolvedValueOnce(null);
    transaction.member.create.mockResolvedValue({ id: 11 });
    transaction.groupJoinRequest.updateMany.mockResolvedValue({ count: 1 });

    await expect(repository.accept(22, 8)).resolves.toEqual({
      status: 'resolved',
      groupId: 1,
      groupName: 'Familia',
      requesterUserId: 7,
      requesterName: 'Ana',
    });

    expect(transaction.member.create).toHaveBeenCalledWith({
      data: { groupId: 1, userId: 7, role: RoleEnum.MEMBER },
    });
    expect(transaction.groupJoinRequest.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: 22,
          status: GroupJoinRequestStatus.PENDING,
        },
        data: expect.objectContaining({
          status: GroupJoinRequestStatus.ACCEPTED,
        }),
      }),
    );
  });

  it('does not resolve a request when the acting member is not an admin', async () => {
    transaction.groupJoinRequest.findUnique.mockResolvedValue({
      id: 22,
      groupId: 1,
      userId: 7,
      status: GroupJoinRequestStatus.PENDING,
      group: { id: 1, name: 'Familia', deletedAt: null },
      user: { id: 7, name: 'Ana' },
    });
    transaction.member.findFirst.mockResolvedValue(null);

    await expect(repository.accept(22, 8)).resolves.toEqual({
      status: 'forbidden',
    });

    expect(transaction.member.create).not.toHaveBeenCalled();
    expect(transaction.groupJoinRequest.update).not.toHaveBeenCalled();
    expect(transaction.groupJoinRequest.updateMany).not.toHaveBeenCalled();
  });
});
