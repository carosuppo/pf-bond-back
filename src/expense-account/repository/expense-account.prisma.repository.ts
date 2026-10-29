import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, RoleEnum } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  calculateDebtsOfMember,
  calculateDebtsToMember,
} from '../balance/expense-account-balance.calculator';
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
import type { UpdateExpenseAccountData } from '../interface/update-expense-account.interface';
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
          createdByUserId: userId,
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

  async updateExpenseAccount(
    accountId: number,
    userId: number,
    data: UpdateExpenseAccountData,
  ): Promise<ExpenseAccountEntity> {
    try {
      return await this.prismaService.$transaction(
        async (tx) => {
          await this.lockActiveAccount(tx, accountId);
          const account = await tx.expenseAccount.findUnique({
            where: { id: accountId },
            include: {
              members: {
                include: { member: { select: { userId: true } } },
              },
            },
          });

          if (!account) {
            throw new NotFoundException('La cuenta no existe.');
          }

          if (!account.members.some((item) => item.member.userId === userId)) {
            throw new ForbiddenException('No estás asociado a esta cuenta.');
          }

          const currentMemberIds = account.members.map((item) => item.memberId);
          const finalMemberIds = data.memberIds ?? currentMemberIds;

          if (finalMemberIds.length === 0) {
            throw new BadRequestException(
              'La cuenta debe conservar al menos un miembro.',
            );
          }

          if (new Set(finalMemberIds).size !== finalMemberIds.length) {
            throw new BadRequestException(
              'No puedes repetir miembros en la cuenta.',
            );
          }

          const groupMemberRows = await tx.member.findMany({
            where: {
              id: { in: finalMemberIds },
              groupId: account.groupId,
            },
            select: { id: true },
          });
          const groupMemberIds = new Set(
            groupMemberRows.map((member) => member.id),
          );
          const invalidMemberIds = finalMemberIds.filter(
            (memberId) => !groupMemberIds.has(memberId),
          );

          if (invalidMemberIds.length > 0) {
            throw new BadRequestException(
              `Los siguientes miembros no pertenecen al grupo de la cuenta: ${invalidMemberIds.join(', ')}`,
            );
          }

          const finalEventId =
            data.eventId === undefined ? account.eventId : data.eventId;
          if (finalEventId !== null) {
            const event = await tx.event.findUnique({
              where: { id: finalEventId },
              select: { id: true, groupId: true, deletedAt: true },
            });

            if (!event || (data.eventId !== undefined && event.deletedAt)) {
              throw new NotFoundException('El evento no existe.');
            }

            if (event.groupId !== account.groupId) {
              throw new BadRequestException(
                'El evento pertenece a otro grupo.',
              );
            }

            const eventMembers = await tx.eventMember.findMany({
              where: {
                eventId: finalEventId,
                memberId: { in: finalMemberIds },
              },
              select: { memberId: true },
            });
            const eventMemberIds = new Set(
              eventMembers.map((member) => member.memberId),
            );
            const invalidEventMemberIds = finalMemberIds.filter(
              (memberId) => !eventMemberIds.has(memberId),
            );

            if (invalidEventMemberIds.length > 0) {
              throw new BadRequestException(
                `Los siguientes miembros no pertenecen al evento: ${invalidEventMemberIds.join(', ')}`,
              );
            }
          }

          const finalMemberIdSet = new Set(finalMemberIds);
          const removedMemberIds = currentMemberIds.filter(
            (memberId) => !finalMemberIdSet.has(memberId),
          );

          if (removedMemberIds.length > 0) {
            const movementsByAccount = await this.findMovementsByAccountIds(
              [accountId],
              tx,
            );
            const movements = movementsByAccount.get(accountId) ?? [];
            const membersWithDebts = removedMemberIds.filter(
              (memberId) =>
                calculateDebtsToMember(movements, memberId).length > 0 ||
                calculateDebtsOfMember(movements, memberId).length > 0,
            );

            if (membersWithDebts.length > 0) {
              throw new BadRequestException({
                message:
                  'No se pueden quitar miembros que tengan obligaciones pendientes en la cuenta.',
                memberIds: membersWithDebts,
              });
            }
          }

          await tx.expenseAccount.update({
            where: { id: accountId },
            data: {
              ...(data.name === undefined ? {} : { name: data.name }),
              ...(data.eventId === undefined ? {} : { eventId: data.eventId }),
            },
          });

          if (removedMemberIds.length > 0) {
            await tx.expenseAccountMember.deleteMany({
              where: {
                expenseAccountId: accountId,
                memberId: { in: removedMemberIds },
              },
            });
          }

          const addedMemberIds = finalMemberIds.filter(
            (memberId) => !currentMemberIds.includes(memberId),
          );
          if (addedMemberIds.length > 0) {
            await tx.expenseAccountMember.createMany({
              data: addedMemberIds.map((memberId) => ({
                expenseAccountId: accountId,
                memberId,
              })),
            });
          }

          const updatedAccount = await tx.expenseAccount.findUniqueOrThrow({
            where: { id: accountId },
            include: { members: { select: { memberId: true } } },
          });

          return {
            id: updatedAccount.id,
            name: updatedAccount.name,
            groupId: updatedAccount.groupId,
            eventId: updatedAccount.eventId,
            memberIds: updatedAccount.members.map((member) => member.memberId),
          };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        (error.code === 'P2002' || error.code === 'P2034')
      ) {
        throw new ConflictException(
          'La cuenta cambió durante la edición. Volvé a cargarla e intentá nuevamente.',
        );
      }
      throw error;
    }
  }

  async deleteExpenseAccount(accountId: number, userId: number): Promise<void> {
    try {
      await this.prismaService.$transaction(
        async (tx) => {
          await this.lockActiveAccount(tx, accountId);
          const account = await tx.expenseAccount.findUniqueOrThrow({
            where: { id: accountId },
            select: {
              id: true,
              groupId: true,
              createdByUserId: true,
              members: { select: { memberId: true } },
            },
          });

          const requester = await tx.member.findUnique({
            where: {
              userId_groupId: {
                userId,
                groupId: account.groupId,
              },
            },
            select: { role: true },
          });
          const isCreator = account.createdByUserId === userId;
          const isGroupAdmin = requester?.role === RoleEnum.ADMIN;

          if (!isCreator && !isGroupAdmin) {
            throw new ForbiddenException(
              'Solo el creador de la cuenta o un administrador del grupo puede eliminarla.',
            );
          }

          const movementsByAccount = await this.findMovementsByAccountIds(
            [accountId],
            tx,
          );
          const movements = movementsByAccount.get(accountId) ?? [];
          const hasPendingObligations = account.members.some(
            ({ memberId }) =>
              calculateDebtsOfMember(movements, memberId).length > 0 ||
              calculateDebtsToMember(movements, memberId).length > 0,
          );

          if (hasPendingObligations) {
            throw new BadRequestException(
              'No se puede eliminar una cuenta con obligaciones pendientes de pago o cobro.',
            );
          }

          // ExpensePayment.confirmedAt is required and defaults to now, so the
          // current data model has no unconfirmed-payment state to validate.
          await tx.expenseAccount.update({
            where: { id: accountId },
            data: { deletedAt: new Date() },
          });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2034'
      ) {
        throw new ConflictException(
          'La cuenta cambió durante la eliminación. Volvé a cargarla e intentá nuevamente.',
        );
      }
      throw error;
    }
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
        deletedAt: null,
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
        createdByUserId: account.createdByUserId,
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
    const account = await this.prismaService.expenseAccount.findFirst({
      where: { id: accountId, deletedAt: null },
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
      createdByUserId: account.createdByUserId,
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
    const expense = await this.prismaService
      .$transaction(
        async (tx) => {
          await this.lockActiveAccount(tx, accountId);
          return tx.expense.create({
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
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      )
      .catch((error: unknown) => {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2034'
        ) {
          throw new ConflictException(
            'La cuenta cambió durante el registro del gasto. Volvé a cargarla e intentá nuevamente.',
          );
        }
        throw error;
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
          account: { deletedAt: null },
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
          await this.lockActiveAccount(tx, accountId);
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
                      account: { deletedAt: null },
                    },
                  }
                : {
                    id: { in: expenseShareIds },
                    memberId,
                    expense: {
                      expenseAccountId: accountId,
                      account: { deletedAt: null },
                    },
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
    client: Prisma.TransactionClient = this.prismaService,
  ): Promise<Map<number, AccountMovementData[]>> {
    if (accountIds.length === 0) {
      return new Map();
    }

    const [expenses, payments] = await Promise.all([
      client.expense.findMany({
        where: {
          expenseAccountId: { in: accountIds },
          account: { deletedAt: null },
        },
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
      client.expensePayment.findMany({
        where: {
          expense: {
            expenseAccountId: { in: accountIds },
            account: { deletedAt: null },
          },
        },
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

  private async lockActiveAccount(
    tx: Prisma.TransactionClient,
    accountId: number,
  ): Promise<void> {
    const accounts = await tx.$queryRaw<
      { id: number; deletedAt: Date | null }[]
    >`SELECT "id", "deletedAt" FROM "ExpenseAccount" WHERE "id" = ${accountId} FOR UPDATE`;

    if (accounts.length === 0 || accounts[0].deletedAt !== null) {
      throw new NotFoundException('La cuenta no existe.');
    }
  }
}
