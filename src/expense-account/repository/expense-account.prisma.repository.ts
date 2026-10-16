import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  ExpenseAccountDetailEntity,
  MyExpenseAccountData,
} from '../entity/expense-account-detail.entity';
import { ExpenseAccountEntity } from '../entity/expense-account.entity';
import { CreateExpenseAccountData } from '../interface/create-expense-account.interface';
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
        movements: [],
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

    return {
      id: account.id,
      name: account.name,
      groupId: account.groupId,
      groupName: account.group.name,
      eventId: account.eventId,
      eventName: account.event?.name ?? null,
      memberIds: account.members.map((member) => member.memberId),
      movements: [],
    };
  }
}
