import { Member, RoleEnum } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { MemberPrismaRepository } from './member.prisma.repository';

describe('MemberPrismaRepository', () => {
  it('promotes a remaining member when the last admin leaves', async () => {
    const transaction = {
      member: {
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          id: 10,
          groupId: 20,
          role: RoleEnum.ADMIN,
        }),
        findFirst: jest
          .fn()
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce({ id: 11 }),
        update: jest.fn().mockResolvedValue({ id: 11 }),
        delete: jest.fn().mockResolvedValue({ id: 10 }),
      },
    };
    const prisma = {
      $transaction: jest.fn(
        (operation: (tx: typeof transaction) => Promise<Member>) =>
          operation(transaction),
      ),
    };
    const repository = new MemberPrismaRepository(
      prisma as unknown as PrismaService,
    );

    await expect(repository.deleteMember(10)).resolves.toEqual({ id: 10 });

    expect(transaction.member.update).toHaveBeenCalledWith({
      where: { id: 11 },
      data: { role: RoleEnum.ADMIN },
    });
    expect(transaction.member.delete).toHaveBeenCalledWith({
      where: { id: 10 },
    });
  });

  it('keeps an existing admin when another admin leaves', async () => {
    const transaction = {
      member: {
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          id: 10,
          groupId: 20,
          role: RoleEnum.ADMIN,
        }),
        findFirst: jest.fn().mockResolvedValue({ id: 11 }),
        update: jest.fn(),
        delete: jest.fn().mockResolvedValue({ id: 10 }),
      },
    };
    const prisma = {
      $transaction: jest.fn(
        (operation: (tx: typeof transaction) => Promise<Member>) =>
          operation(transaction),
      ),
    };
    const repository = new MemberPrismaRepository(
      prisma as unknown as PrismaService,
    );

    await repository.deleteMember(10);

    expect(transaction.member.findFirst).toHaveBeenCalledTimes(1);
    expect(transaction.member.update).not.toHaveBeenCalled();
    expect(transaction.member.delete).toHaveBeenCalledWith({
      where: { id: 10 },
    });
  });
});
