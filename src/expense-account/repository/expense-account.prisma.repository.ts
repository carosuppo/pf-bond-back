import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  ExpenseAccountDetailEntity,
  MyExpenseAccountData,
} from '../entity/expense-account-detail.entity';
import { ExpenseAccountEntity } from '../entity/expense-account.entity';
import { ExpenseEntity } from '../entity/expense.entity';
import {
  type ExpensePaymentEntity,
  type PendingExpenseShareEntity,
} from '../entity/expense-payment.entity';
import type { AccountMovementData } from '../interface/account-movement.interface';
import { CreateExpenseAccountData } from '../interface/create-expense-account.interface';
import { CreateExpenseData } from '../interface/create-expense.interface';
import {
  ExpenseEventForValidation,
  IExpenseAccountRepository,
} from './expense-account.repository.interface';

@Injectable()
export class ExpenseAccountPrismaRepository implements IExpenseAccountRepository {
  constructor(private readonly prismaService: PrismaService) {}

  async create(
    data: CreateExpenseAccountData,
    groupId: number,
    userId: number,
  ): Promise<ExpenseAccountEntity> {
    return this.prismaService.$transaction(async (tx) => {
      const creator = await tx.member.findUniqueOrThrow({
        where: {
          userId_groupId: {
            userId,
            groupId,
          },
        },
      });

      const memberIds = [...new Set([creator.id, ...data.memberIds])];

      const expenseAccount = await tx.expenseAccount.create({
        data: {
          name: data.name,
          groupId,
          eventId: data.eventId ?? null,
          members: {
            create: memberIds.map((memberId) => ({
              memberId,
            })),
          },
        },
        include: {
          members: true,
        },
      });

      return {
        id: expenseAccount.id,
        name: expenseAccount.name,
        groupId: expenseAccount.groupId,
        eventId: expenseAccount.eventId,
        memberIds: expenseAccount.members.map(
          (expenseAccountMember) => expenseAccountMember.memberId,
        ),
      };
    });
  }

  async findEventById(
    eventId: number,
  ): Promise<ExpenseEventForValidation | null> {
    return this.prismaService.event.findUnique({
      where: { id: eventId },
      select: { id: true, groupId: true, deletedAt: true },
    });
  }

  async findEventMemberIds(eventId: number): Promise<number[]> {
    const eventMembers = await this.prismaService.eventMember.findMany({
      where: { eventId },
      select: { memberId: true },
    });

    return eventMembers.map((eventMember) => eventMember.memberId);
  }

  async findAccountsByUserId(userId: number): Promise<MyExpenseAccountData[]> {
    const accounts = await this.prismaService.expenseAccount.findMany({
      where: {
        members: {
          some: {
            member: { userId },
          },
        },
      },
      include: {
        members: {
          select: {
            memberId: true,
            member: { select: { userId: true } },
          },
        },
        group: { select: { name: true } },
        event: { select: { name: true } },
      },
      orderBy: { name: 'asc' },
    });

    const movementsByAccount = await this.findMovementsByAccountIds(
      accounts.map((account) => account.id),
    );

    return accounts.map((account) => {
      const myMember = account.members.find(
        (member) => member.member.userId === userId,
      );

      if (!myMember) {
        throw new Error('No se encontró el miembro del usuario en su cuenta.');
      }

      return {
        id: account.id,
        name: account.name,
        groupId: account.groupId,
        groupName: account.group.name,
        eventId: account.eventId,
        eventName: account.event?.name ?? null,
        memberIds: account.members.map((member) => member.memberId),
        myMemberId: myMember.memberId,
        movements: movementsByAccount.get(account.id) ?? [],
      };
    });
  }

  async findAccountById(
    accountId: number,
  ): Promise<ExpenseAccountDetailEntity | null> {
    const account = await this.prismaService.expenseAccount.findUnique({
      where: { id: accountId },
      include: {
        members: { select: { memberId: true } },
        group: { select: { name: true } },
        event: { select: { name: true } },
      },
    });

    if (!account) {
      return null;
    }

    const movements = await this.findMovementsByAccountId(accountId);

    return {
      id: account.id,
      name: account.name,
      groupId: account.groupId,
      groupName: account.group.name,
      eventId: account.eventId,
      eventName: account.event?.name ?? null,
      memberIds: account.members.map((member) => member.memberId),
      movements,
    };
  }

  async createExpense(
    data: CreateExpenseData,
    accountId: number,
  ): Promise<ExpenseEntity> {
    const expense = await this.prismaService.expense.create({
      data: {
        expenseAccountId: accountId,
        payerMemberId: data.payerMemberId,
        title: data.title ?? null,
        amountCents: data.amountCents,
        splitType: data.splitType,
        shares: {
          create: data.shares.map((share) => ({
            memberId: share.memberId,
            amountCents: share.amountCents,
          })),
        },
      },
      include: {
        shares: true,
      },
    });

    return {
      id: expense.id,
      expenseAccountId: expense.expenseAccountId,
      title: expense.title,
      amountCents: expense.amountCents,
      splitType: expense.splitType,
      payerMemberId: expense.payerMemberId,
      shares: expense.shares.map((share) => ({
        memberId: share.memberId,
        amountCents: share.amountCents,
      })),
      createdAt: expense.createdAt,
    };
  }

  async findPendingExpenseShares(
    accountId: number,
    memberId: number,
  ): Promise<PendingExpenseShareEntity[]> {
    const shares = await this.prismaService.expenseShare.findMany({
      where: {
        memberId,
        amountCents: { gt: 0 },
        payment: null,
        expense: {
          expenseAccountId: accountId,
          payerMemberId: { not: memberId },
        },
      },
      select: {
        id: true,
        expenseId: true,
        amountCents: true,
        expense: {
          select: {
            title: true,
            payerMemberId: true,
            createdAt: true,
          },
        },
      },
      orderBy: { id: 'asc' },
    });

    return shares.map((share) => ({
      expenseShareId: share.id,
      expenseId: share.expenseId,
      expenseTitle: share.expense.title,
      payerMemberId: share.expense.payerMemberId,
      amountCents: share.amountCents,
      createdAt: share.expense.createdAt,
    }));
  }

  async registerExpensePayments(
    accountId: number,
    memberId: number,
    expenseShareIds: number[] | null,
  ): Promise<ExpensePaymentEntity[]> {
    try {
      return await this.prismaService.$transaction(
        async (tx) => {
          const accountMember = await tx.expenseAccountMember.findUnique({
            where: {
              expenseAccountId_memberId: {
                expenseAccountId: accountId,
                memberId,
              },
            },
            select: { id: true },
          });

          if (!accountMember) {
            throw new ForbiddenException('No estás asociado a esta cuenta.');
          }

          const selectedShares = await tx.expenseShare.findMany({
            where:
              expenseShareIds === null
                ? {
                    memberId,
                    amountCents: { gt: 0 },
                    payment: null,
                    expense: {
                      expenseAccountId: accountId,
                      payerMemberId: { not: memberId },
                    },
                  }
                : {
                    id: { in: expenseShareIds },
                    memberId,
                    expense: { expenseAccountId: accountId },
                  },
            include: {
              expense: { select: { payerMemberId: true } },
              payment: { select: { id: true } },
            },
            orderBy: { id: 'asc' },
          });

          if (
            expenseShareIds !== null &&
            selectedShares.length !== expenseShareIds.length
          ) {
            throw new BadRequestException(
              'Una o más participaciones no pertenecen a tu cuenta o no son tuyas.',
            );
          }

          if (
            selectedShares.some(
              (share) =>
                share.expense.payerMemberId === memberId ||
                share.amountCents <= 0,
            )
          ) {
            throw new BadRequestException(
              'No se puede pagar una participación propia ni con importe no positivo.',
            );
          }

          if (selectedShares.some((share) => share.payment !== null)) {
            throw new ConflictException(
              'Una o más participaciones seleccionadas ya están pagadas.',
            );
          }

          const payments: ExpensePaymentEntity[] = [];

          for (const share of selectedShares) {
            const payment = await tx.expensePayment.create({
              data: {
                expenseId: share.expenseId,
                expenseShareId: share.id,
                fromMemberId: memberId,
                toMemberId: share.expense.payerMemberId,
                amountCents: share.amountCents,
              },
            });
            payments.push({
              id: payment.id,
              expenseId: payment.expenseId,
              expenseShareId: payment.expenseShareId,
              fromMemberId: payment.fromMemberId,
              toMemberId: payment.toMemberId,
              amountCents: payment.amountCents,
              createdAt: payment.createdAt,
              confirmedAt: payment.confirmedAt,
            });
          }

          return payments;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        (error.code === 'P2002' || error.code === 'P2034')
      ) {
        throw new ConflictException(
          'Una o más participaciones ya fueron pagadas por otra operación.',
        );
      }
      throw error;
    }
  }

  async findMovementsByAccountId(
    accountId: number,
  ): Promise<AccountMovementData[]> {
    const movements = await this.findMovementsByAccountIds([accountId]);

    return movements.get(accountId) ?? [];
  }

  private async findMovementsByAccountIds(
    accountIds: number[],
  ): Promise<Map<number, AccountMovementData[]>> {
    if (accountIds.length === 0) {
      return new Map();
    }

    const [expenses, payments] = await Promise.all([
      this.prismaService.expense.findMany({
        where: { expenseAccountId: { in: accountIds } },
        include: {
          shares: {
            select: {
              memberId: true,
              amountCents: true,
              payment: { select: { id: true } },
            },
          },
        },
        orderBy: { createdAt: 'asc' },
      }),
      this.prismaService.expensePayment.findMany({
        where: { expense: { expenseAccountId: { in: accountIds } } },
        include: {
          expense: {
            select: { expenseAccountId: true, title: true },
          },
        },
        orderBy: { createdAt: 'asc' },
      }),
    ]);

    const movementsByAccount = new Map<number, AccountMovementData[]>();

    for (const expense of expenses) {
      const movements = movementsByAccount.get(expense.expenseAccountId) ?? [];
      movements.push({
        kind: 'EXPENSE',
        id: expense.id,
        title: expense.title,
        amountCents: expense.amountCents,
        payerMemberId: expense.payerMemberId,
        shares: expense.shares.map((share) => ({
          memberId: share.memberId,
          amountCents: share.amountCents,
          isPaid:
            share.payment !== null || share.memberId === expense.payerMemberId,
        })),
        createdAt: expense.createdAt,
      });
      movementsByAccount.set(expense.expenseAccountId, movements);
    }

    for (const payment of payments) {
      const accountId = payment.expense.expenseAccountId;
      const movements = movementsByAccount.get(accountId) ?? [];
      movements.push({
        kind: 'PAYMENT',
        id: payment.id,
        expenseId: payment.expenseId,
        expenseShareId: payment.expenseShareId,
        expenseTitle: payment.expense.title,
        amountCents: payment.amountCents,
        fromMemberId: payment.fromMemberId,
        toMemberId: payment.toMemberId,
        createdAt: payment.createdAt,
        confirmedAt: payment.confirmedAt,
      });
      movementsByAccount.set(accountId, movements);
    }

    for (const movements of movementsByAccount.values()) {
      movements.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    }

    return movementsByAccount;
  }
}
