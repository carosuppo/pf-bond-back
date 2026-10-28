import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  ExpenseAccountDetailEntity,
  MyExpenseAccountData,
} from '../entity/expense-account-detail.entity';
import { ExpenseAccountEntity } from '../entity/expense-account.entity';
import { ExpenseEntity } from '../entity/expense.entity';
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

    const expenses = await this.prismaService.expense.findMany({
      where: { expenseAccountId: { in: accountIds } },
      include: {
        shares: {
          select: { memberId: true, amountCents: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

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
        })),
        createdAt: expense.createdAt,
      });
      movementsByAccount.set(expense.expenseAccountId, movements);
    }

    return movementsByAccount;
  }
}
