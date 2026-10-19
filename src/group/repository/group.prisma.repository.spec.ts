import { PrismaService } from '../../prisma/prisma.service';
import type { IMemberRepository } from '../../member/repository/member.repository.interface';
import { GroupPrismaRepository } from './group.prisma.repository';

interface GroupUpdateManyInput {
  where: { id: number; deletedAt: null };
  data: { deletedAt: Date };
}

interface MemberDeleteManyInput {
  where: { groupId: number };
}

describe('GroupPrismaRepository', () => {
  it('removes a member and leaves the active group available', async () => {
    const transaction = {
      group: {
        findFirst: jest.fn().mockResolvedValue({ id: 5 }),
      },
      member: {
        findUnique: jest.fn().mockResolvedValue({ id: 12 }),
        count: jest.fn().mockResolvedValue(2),
      },
    };
    const memberRepository = {
      deleteMember: jest.fn().mockResolvedValue({ id: 12 }),
    };
    const prisma = {
      $transaction: jest.fn(
        async (operation: (tx: typeof transaction) => Promise<unknown>) =>
          operation(transaction),
      ),
    };
    const repository = new GroupPrismaRepository(
      prisma as unknown as PrismaService,
      memberRepository as unknown as IMemberRepository,
    );

    await expect(repository.leave(5, 8)).resolves.toEqual({
      status: 'left',
      memberId: 12,
    });

    expect(transaction.member.findUnique).toHaveBeenCalledWith({
      where: { userId_groupId: { userId: 8, groupId: 5 } },
      select: { id: true },
    });
    expect(memberRepository.deleteMember).toHaveBeenCalledWith(12, transaction);
  });

  it('soft-deletes a group when its only member leaves', async () => {
    const updateMany = jest.fn((input: GroupUpdateManyInput) =>
      Promise.resolve({ count: input.where.id === 5 ? 1 : 0 }),
    );
    const transaction = {
      group: {
        findFirst: jest.fn().mockResolvedValue({ id: 5 }),
        updateMany,
      },
      member: {
        findUnique: jest.fn().mockResolvedValue({ id: 12 }),
        count: jest.fn().mockResolvedValue(1),
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    const memberRepository = { deleteMember: jest.fn() };
    const prisma = {
      $transaction: jest.fn(
        async (operation: (tx: typeof transaction) => Promise<unknown>) =>
          operation(transaction),
      ),
    };
    const repository = new GroupPrismaRepository(
      prisma as unknown as PrismaService,
      memberRepository as unknown as IMemberRepository,
    );

    await expect(repository.leave(5, 8)).resolves.toEqual({
      status: 'deleted',
      memberId: 12,
    });

    expect(updateMany).toHaveBeenCalledTimes(1);
    const updateInput = updateMany.mock.calls[0][0];
    expect(updateInput.where).toEqual({ id: 5, deletedAt: null });
    expect(updateInput.data.deletedAt).toBeInstanceOf(Date);
    expect(transaction.member.deleteMany).toHaveBeenCalledWith({
      where: { groupId: 5 },
    });
    expect(memberRepository.deleteMember).not.toHaveBeenCalled();
  });

  it('rejects a user without membership without changing the group', async () => {
    const transaction = {
      group: {
        findFirst: jest.fn().mockResolvedValue({ id: 5 }),
        updateMany: jest.fn(),
      },
      member: {
        findUnique: jest.fn().mockResolvedValue(null),
        count: jest.fn(),
        deleteMany: jest.fn(),
      },
    };
    const memberRepository = { deleteMember: jest.fn() };
    const prisma = {
      $transaction: jest.fn(
        async (operation: (tx: typeof transaction) => Promise<unknown>) =>
          operation(transaction),
      ),
    };
    const repository = new GroupPrismaRepository(
      prisma as unknown as PrismaService,
      memberRepository as unknown as IMemberRepository,
    );

    await expect(repository.leave(5, 8)).resolves.toEqual({
      status: 'notMember',
    });

    expect(transaction.member.count).not.toHaveBeenCalled();
    expect(transaction.group.updateMany).not.toHaveBeenCalled();
  });

  it('records deletion and removes all memberships in one transaction', async () => {
    const updateMany = jest.fn((input: GroupUpdateManyInput) =>
      Promise.resolve({ count: input.where.id === 5 ? 1 : 0 }),
    );
    const deleteMany = jest.fn((input: MemberDeleteManyInput) =>
      Promise.resolve({ count: input.where.groupId }),
    );
    const tx = {
      group: {
        updateMany,
      },
      member: {
        deleteMany,
      },
    };
    const prisma = {
      $transaction: jest.fn(
        async (operation: (transaction: typeof tx) => Promise<boolean>) =>
          operation(tx),
      ),
    };
    const repository = new GroupPrismaRepository(
      prisma as unknown as PrismaService,
      {} as IMemberRepository,
    );

    await expect(repository.softDelete(5)).resolves.toBe(true);

    expect(updateMany).toHaveBeenCalledTimes(1);
    const updateInput = updateMany.mock.calls[0][0];
    expect(updateInput.where).toEqual({ id: 5, deletedAt: null });
    expect(updateInput.data.deletedAt).toBeInstanceOf(Date);
    expect(deleteMany).toHaveBeenCalledWith({ where: { groupId: 5 } });
  });

  it('does not remove memberships when the group was already deleted', async () => {
    const updateMany = jest.fn((input: GroupUpdateManyInput) =>
      Promise.resolve({ count: input.where.id === 5 ? 0 : 1 }),
    );
    const deleteMany = jest.fn((input: MemberDeleteManyInput) =>
      Promise.resolve({ count: input.where.groupId }),
    );
    const tx = {
      group: {
        updateMany,
      },
      member: {
        deleteMany,
      },
    };
    const prisma = {
      $transaction: jest.fn(
        async (operation: (transaction: typeof tx) => Promise<boolean>) =>
          operation(tx),
      ),
    };
    const repository = new GroupPrismaRepository(
      prisma as unknown as PrismaService,
      {} as IMemberRepository,
    );

    await expect(repository.softDelete(5)).resolves.toBe(false);

    expect(deleteMany).not.toHaveBeenCalled();
  });
});
