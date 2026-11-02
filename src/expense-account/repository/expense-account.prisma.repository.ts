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
  type PendingExpenseAdjustmentEntity,
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

type ExpenseShareWithHistory = Prisma.ExpenseShareGetPayload<{
  include: { payment: true; adjustments: true };
}>;

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
    userId: number,
  ): Promise<ExpenseEntity> {
    const expense = await this.prismaService
      .$transaction(
        async (tx) => {
          await this.lockActiveAccount(tx, accountId);
          return tx.expense.create({
            data: {
              expenseAccountId: accountId,
              payerMemberId: data.payerMemberId,
              createdByUserId: userId,
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
      createdByUserId: expense.createdByUserId,
      lastEditedByUserId: expense.lastEditedByUserId,
      lastEditedAt: expense.lastEditedAt,
      shares: expense.shares.map((share) => ({
        memberId: share.memberId,
        amountCents: share.amountCents,
        isCurrent: share.isCurrent,
      })),
      createdAt: expense.createdAt,
    };
  }

  async updateExpense(
    accountId: number,
    expenseId: number,
    userId: number,
    data: CreateExpenseData,
  ): Promise<ExpenseEntity> {
    try {
      return await this.prismaService.$transaction(
        async (tx) => {
          await this.lockActiveAccount(tx, accountId);
          const account = await tx.expenseAccount.findUniqueOrThrow({
            where: { id: accountId },
            select: {
              id: true,
              groupId: true,
              eventId: true,
              members: { select: { memberId: true } },
            },
          });
          const expense = await tx.expense.findFirst({
            where: { id: expenseId, expenseAccountId: accountId },
            include: {
              shares: { include: { payment: true, adjustments: true } },
            },
          });

          if (!expense) {
            throw new NotFoundException('El gasto no existe en esta cuenta.');
          }

          const requester = await tx.member.findUnique({
            where: {
              userId_groupId: { userId, groupId: account.groupId },
            },
            select: { role: true },
          });
          const isCreator = expense.createdByUserId === userId;
          const isGroupAdmin = requester?.role === RoleEnum.ADMIN;
          if (!isCreator && !isGroupAdmin) {
            throw new ForbiddenException(
              'Solo quien registró el gasto o un administrador del grupo puede editarlo.',
            );
          }

          if (data.amountCents <= 0 || data.shares.length === 0) {
            throw new BadRequestException(
              'El importe debe ser mayor que cero y el gasto debe tener participantes.',
            );
          }
          const shareMemberIds = data.shares.map((share) => share.memberId);
          if (new Set(shareMemberIds).size !== shareMemberIds.length) {
            throw new BadRequestException(
              'No puedes repetir participantes en el reparto.',
            );
          }
          const assignedCents = data.shares.reduce(
            (sum, share) => sum + share.amountCents,
            0,
          );
          if (assignedCents !== data.amountCents) {
            throw new BadRequestException(
              'La suma de los importes asignados no coincide con el total del gasto.',
            );
          }

          const requiredMemberIds = [
            ...new Set([data.payerMemberId, ...shareMemberIds]),
          ];
          const accountMemberIds = new Set(
            account.members.map((member) => member.memberId),
          );
          const invalidAccountMemberIds = requiredMemberIds.filter(
            (memberId) => !accountMemberIds.has(memberId),
          );
          if (invalidAccountMemberIds.length > 0) {
            throw new BadRequestException(
              `Los siguientes miembros no pertenecen a la cuenta: ${invalidAccountMemberIds.join(', ')}`,
            );
          }

          if (account.eventId !== null) {
            const eventMembers = await tx.eventMember.findMany({
              where: {
                eventId: account.eventId,
                memberId: { in: requiredMemberIds },
              },
              select: { memberId: true },
            });
            const eventMemberIds = new Set(
              eventMembers.map((member) => member.memberId),
            );
            const invalidEventMemberIds = requiredMemberIds.filter(
              (memberId) => !eventMemberIds.has(memberId),
            );
            if (invalidEventMemberIds.length > 0) {
              throw new BadRequestException(
                `Los siguientes miembros no pertenecen al evento de la cuenta: ${invalidEventMemberIds.join(', ')}`,
              );
            }
          }

          if (data.payerMemberId !== expense.payerMemberId) {
            const [paymentCount, settledAdjustmentCount] = await Promise.all([
              tx.expensePayment.count({ where: { expenseId } }),
              tx.expenseAdjustment.count({
                where: { expenseId, status: 'PAID' },
              }),
            ]);
            if (paymentCount > 0 || settledAdjustmentCount > 0) {
              throw new BadRequestException(
                'No se puede cambiar el pagador porque el gasto ya tiene pagos confirmados.',
              );
            }
          }

          const inputSharesByMemberId = new Map(
            data.shares.map((share) => [share.memberId, share.amountCents]),
          );
          const existingSharesByMemberId = new Map(
            expense.shares.map((share) => [share.memberId, share]),
          );
          const currentShares = new Map<number, ExpenseShareWithHistory>();

          for (const [memberId, amountCents] of inputSharesByMemberId) {
            const existingShare = existingSharesByMemberId.get(memberId);
            const updatedShare = existingShare
              ? await tx.expenseShare.update({
                  where: { id: existingShare.id },
                  data: { amountCents, isCurrent: true },
                  include: { payment: true, adjustments: true },
                })
              : await tx.expenseShare.create({
                  data: { expenseId, memberId, amountCents, isCurrent: true },
                  include: { payment: true, adjustments: true },
                });
            currentShares.set(memberId, updatedShare);
          }

          const removedShares = expense.shares.filter(
            (share) => !inputSharesByMemberId.has(share.memberId),
          );
          for (const removedShare of removedShares) {
            const inactiveShare = await tx.expenseShare.update({
              where: { id: removedShare.id },
              data: { isCurrent: false },
              include: { payment: true, adjustments: true },
            });
            currentShares.set(removedShare.memberId, inactiveShare);
          }

          await tx.expense.update({
            where: { id: expenseId },
            data: {
              title: data.title === undefined ? expense.title : data.title,
              amountCents: data.amountCents,
              payerMemberId: data.payerMemberId,
              splitType: data.splitType,
              lastEditedByUserId: userId,
              lastEditedAt: new Date(),
            },
          });

          for (const [memberId, share] of currentShares) {
            await this.reconcileExpenseShareAdjustments(
              tx,
              expenseId,
              share,
              inputSharesByMemberId.has(memberId),
              inputSharesByMemberId.get(memberId) ?? 0,
              data.payerMemberId,
            );
          }

          const updatedExpense = await tx.expense.findUniqueOrThrow({
            where: { id: expenseId },
            include: {
              shares: {
                where: { isCurrent: true },
                select: { memberId: true, amountCents: true, isCurrent: true },
              },
            },
          });

          return {
            id: updatedExpense.id,
            expenseAccountId: updatedExpense.expenseAccountId,
            title: updatedExpense.title,
            amountCents: updatedExpense.amountCents,
            splitType: updatedExpense.splitType,
            payerMemberId: updatedExpense.payerMemberId,
            createdByUserId: updatedExpense.createdByUserId,
            lastEditedByUserId: updatedExpense.lastEditedByUserId,
            lastEditedAt: updatedExpense.lastEditedAt,
            shares: updatedExpense.shares,
            createdAt: updatedExpense.createdAt,
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
          'El gasto cambió durante la edición. Volvé a cargarlo e intentá nuevamente.',
        );
      }
      throw error;
    }
  }

  async deleteExpense(
    accountId: number,
    expenseId: number,
    userId: number,
  ): Promise<void> {
    try {
      await this.prismaService.$transaction(
        async (tx) => {
          await this.lockActiveAccount(tx, accountId);
          const expense = await tx.expense.findFirst({
            where: {
              id: expenseId,
              expenseAccountId: accountId,
              account: { deletedAt: null },
            },
            include: {
              account: { select: { groupId: true } },
              payments: { select: { id: true } },
              shares: {
                select: {
                  id: true,
                  payment: { select: { id: true } },
                  adjustments: {
                    select: {
                      id: true,
                      expenseId: true,
                      expenseShareId: true,
                      status: true,
                      payment: { select: { id: true } },
                    },
                  },
                },
              },
              adjustments: {
                select: {
                  id: true,
                  expenseShareId: true,
                  status: true,
                  payment: { select: { id: true } },
                },
              },
            },
          });

          if (!expense) {
            throw new NotFoundException(
              'El gasto no existe en esta cuenta o la cuenta ya no está disponible.',
            );
          }

          const requester = await tx.member.findUnique({
            where: {
              userId_groupId: {
                userId,
                groupId: expense.account.groupId,
              },
            },
            select: { role: true },
          });
          const isCreator = expense.createdByUserId === userId;
          const isGroupAdmin = requester?.role === RoleEnum.ADMIN;
          if (!isCreator && !isGroupAdmin) {
            throw new ForbiddenException(
              'Solo quien registró el gasto o un administrador del grupo puede eliminarlo.',
            );
          }

          const shareIds = new Set(expense.shares.map((share) => share.id));
          const shareAdjustments = expense.shares.flatMap(
            (share) => share.adjustments,
          );
          const directAdjustmentIds = new Set(
            expense.adjustments.map((adjustment) => adjustment.id),
          );
          const shareAdjustmentIds = new Set(
            shareAdjustments.map((adjustment) => adjustment.id),
          );
          const hasInconsistentAdjustments =
            directAdjustmentIds.size !== shareAdjustmentIds.size ||
            [...directAdjustmentIds].some(
              (adjustmentId) => !shareAdjustmentIds.has(adjustmentId),
            ) ||
            expense.adjustments.some(
              (adjustment) => !shareIds.has(adjustment.expenseShareId),
            ) ||
            shareAdjustments.some(
              (adjustment) => adjustment.expenseId !== expenseId,
            );
          if (hasInconsistentAdjustments) {
            throw new ConflictException(
              'El gasto tiene ajustes vinculados a otras participaciones. No se puede eliminar sin afectar otros datos.',
            );
          }

          const hasConfirmedPayments =
            expense.payments.length > 0 ||
            expense.shares.some(
              (share) =>
                share.payment !== null ||
                share.adjustments.some(
                  (adjustment) => adjustment.payment !== null,
                ),
            ) ||
            expense.adjustments.some(
              (adjustment) => adjustment.payment !== null,
            );
          const hasPaidAdjustments = expense.adjustments.some(
            (adjustment) => adjustment.status === 'PAID',
          );
          if (hasConfirmedPayments || hasPaidAdjustments) {
            throw new BadRequestException(
              'No se puede eliminar el gasto porque tiene pagos confirmados o ajustes económicos ya pagados.',
            );
          }

          const hasPendingAdjustments = expense.adjustments.some(
            (adjustment) => adjustment.status === 'PENDING',
          );
          if (hasPendingAdjustments) {
            throw new BadRequestException(
              'No se puede eliminar el gasto porque tiene ajustes económicos pendientes de pago.',
            );
          }

          // Canceled adjustments have no active payment history and restrict
          // the expense/share foreign keys, so remove them before the cascade.
          await tx.expenseAdjustment.deleteMany({
            where: { expenseId },
          });
          await tx.expense.delete({ where: { id: expenseId } });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2034'
      ) {
        throw new ConflictException(
          'El gasto o sus obligaciones cambiaron durante la eliminación. Volvé a cargar la cuenta e intentá nuevamente.',
        );
      }
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2003'
      ) {
        throw new ConflictException(
          'No se puede eliminar el gasto porque conserva relaciones o historial de pagos asociado.',
        );
      }
      throw error;
    }
  }

  private async reconcileExpenseShareAdjustments(
    tx: Prisma.TransactionClient,
    expenseId: number,
    share: ExpenseShareWithHistory,
    isCurrent: boolean,
    currentAmountCents: number,
    payerMemberId: number,
  ): Promise<void> {
    const confirmedSharePayment = share.payment;
    const paidAdjustments = share.adjustments.filter(
      (adjustment) => adjustment.status === 'PAID',
    );
    const pendingAdjustments = share.adjustments.filter(
      (adjustment) => adjustment.status === 'PENDING',
    );
    const hasPaymentHistory =
      share.payment !== null ||
      paidAdjustments.length > 0 ||
      pendingAdjustments.length > 0;

    if (!hasPaymentHistory) return;

    const paidAdjustmentNet = paidAdjustments.reduce((net, adjustment) => {
      if (adjustment.debtorMemberId === share.memberId) {
        return net + adjustment.amountCents;
      }
      if (adjustment.creditorMemberId === share.memberId) {
        return net - adjustment.amountCents;
      }
      return net;
    }, 0);
    const currentOwedCents =
      isCurrent && share.memberId !== payerMemberId ? currentAmountCents : 0;
    const outstandingCents =
      currentOwedCents -
      (confirmedSharePayment?.amountCents ?? 0) -
      paidAdjustmentNet;
    const amountCents = Math.abs(outstandingCents);
    const debtorMemberId =
      outstandingCents > 0 ? share.memberId : payerMemberId;
    const creditorMemberId =
      outstandingCents > 0 ? payerMemberId : share.memberId;
    const hasNoOutstandingAdjustment = outstandingCents === 0;
    const hasMatchingPendingAdjustment =
      !hasNoOutstandingAdjustment &&
      pendingAdjustments.length === 1 &&
      pendingAdjustments[0].debtorMemberId === debtorMemberId &&
      pendingAdjustments[0].creditorMemberId === creditorMemberId &&
      pendingAdjustments[0].amountCents === amountCents;

    if (hasMatchingPendingAdjustment) return;

    if (pendingAdjustments.length > 0) {
      await tx.expenseAdjustment.updateMany({
        where: {
          id: { in: pendingAdjustments.map((adjustment) => adjustment.id) },
          status: 'PENDING',
        },
        data: { status: 'CANCELED' },
      });
    }

    if (!hasNoOutstandingAdjustment) {
      await tx.expenseAdjustment.create({
        data: {
          expenseId,
          expenseShareId: share.id,
          debtorMemberId,
          creditorMemberId,
          amountCents,
        },
      });
    }
  }

  async findPendingExpenseShares(
    accountId: number,
    memberId: number,
  ): Promise<PendingExpenseShareEntity[]> {
    const shares = await this.prismaService.expenseShare.findMany({
      where: {
        memberId,
        isCurrent: true,
        amountCents: { gt: 0 },
        payment: null,
        adjustments: { none: { status: { in: ['PENDING', 'PAID'] } } },
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
      kind: 'EXPENSE_SHARE',
      expenseShareId: share.id,
      expenseId: share.expenseId,
      expenseTitle: share.expense.title,
      payerMemberId: share.expense.payerMemberId,
      amountCents: share.amountCents,
      createdAt: share.expense.createdAt,
    }));
  }

  async findPendingExpenseAdjustments(
    accountId: number,
    memberId: number,
  ): Promise<PendingExpenseAdjustmentEntity[]> {
    const adjustments = await this.prismaService.expenseAdjustment.findMany({
      where: {
        debtorMemberId: memberId,
        status: 'PENDING',
        expense: {
          expenseAccountId: accountId,
          account: { deletedAt: null },
        },
      },
      include: {
        expense: { select: { title: true } },
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });

    return adjustments.map((adjustment) => ({
      kind: 'ADJUSTMENT',
      adjustmentId: adjustment.id,
      expenseId: adjustment.expenseId,
      expenseShareId: adjustment.expenseShareId,
      expenseTitle: adjustment.expense.title,
      debtorMemberId: adjustment.debtorMemberId,
      creditorMemberId: adjustment.creditorMemberId,
      amountCents: adjustment.amountCents,
      createdAt: adjustment.createdAt,
    }));
  }

  async registerExpensePayments(
    accountId: number,
    memberId: number,
    expenseShareIds: number[] | null,
    adjustmentIds: number[] | null,
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

          const selectAllPending =
            expenseShareIds === null && adjustmentIds === null;
          const selectedShares = await tx.expenseShare.findMany({
            where: selectAllPending
              ? {
                  memberId,
                  isCurrent: true,
                  amountCents: { gt: 0 },
                  payment: null,
                  adjustments: {
                    none: { status: { in: ['PENDING', 'PAID'] } },
                  },
                  expense: {
                    expenseAccountId: accountId,
                    payerMemberId: { not: memberId },
                    account: { deletedAt: null },
                  },
                }
              : {
                  id: { in: expenseShareIds ?? [] },
                  memberId,
                  isCurrent: true,
                  amountCents: { gt: 0 },
                  payment: null,
                  adjustments: {
                    none: { status: { in: ['PENDING', 'PAID'] } },
                  },
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
            !selectAllPending &&
            selectedShares.length !== (expenseShareIds ?? []).length
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
              kind: 'EXPENSE_SHARE',
              id: payment.id,
              expenseId: payment.expenseId,
              expenseShareId: share.id,
              adjustmentId: null,
              fromMemberId: payment.fromMemberId,
              toMemberId: payment.toMemberId,
              amountCents: payment.amountCents,
              createdAt: payment.createdAt,
              confirmedAt: payment.confirmedAt,
            });
          }

          const selectedAdjustments = await tx.expenseAdjustment.findMany({
            where: selectAllPending
              ? {
                  debtorMemberId: memberId,
                  status: 'PENDING',
                  expense: {
                    expenseAccountId: accountId,
                    account: { deletedAt: null },
                  },
                }
              : {
                  id: { in: adjustmentIds ?? [] },
                  debtorMemberId: memberId,
                  status: 'PENDING',
                  expense: {
                    expenseAccountId: accountId,
                    account: { deletedAt: null },
                  },
                },
            orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
          });

          if (
            !selectAllPending &&
            selectedAdjustments.length !== (adjustmentIds ?? []).length
          ) {
            throw new BadRequestException(
              'Uno o más ajustes no están pendientes, no pertenecen a tu cuenta o no son tuyos.',
            );
          }

          for (const adjustment of selectedAdjustments) {
            const settledAt = new Date();
            const settledAdjustment = await tx.expenseAdjustment.updateMany({
              where: { id: adjustment.id, status: 'PENDING' },
              data: {
                status: 'PAID',
                settledAt,
                settledByMemberId: memberId,
              },
            });
            if (settledAdjustment.count !== 1) {
              throw new ConflictException(
                'Uno o más ajustes ya fueron pagados por otra operación.',
              );
            }
            const payment = await tx.expensePayment.create({
              data: {
                expenseId: adjustment.expenseId,
                adjustmentId: adjustment.id,
                fromMemberId: adjustment.debtorMemberId,
                toMemberId: adjustment.creditorMemberId,
                amountCents: adjustment.amountCents,
                confirmedAt: settledAt,
              },
            });
            payments.push({
              kind: 'ADJUSTMENT',
              id: payment.id,
              expenseId: adjustment.expenseId,
              expenseShareId: adjustment.expenseShareId,
              adjustmentId: adjustment.id,
              fromMemberId: adjustment.debtorMemberId,
              toMemberId: adjustment.creditorMemberId,
              amountCents: adjustment.amountCents,
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

  async annulExpensePayment(
    accountId: number,
    paymentId: number,
    userId: number,
  ): Promise<ExpensePaymentEntity> {
    try {
      return await this.prismaService.$transaction(
        async (tx) => {
          await this.lockActiveAccount(tx, accountId);
          const payment = await tx.expensePayment.findFirst({
            where: {
              id: paymentId,
              expense: {
                expenseAccountId: accountId,
                account: { deletedAt: null },
              },
            },
            include: {
              fromMember: { select: { id: true, userId: true } },
              adjustment: true,
            },
          });

          if (!payment) {
            throw new NotFoundException(
              'El pago no existe en esta cuenta o la cuenta ya no está disponible.',
            );
          }
          if (payment.fromMember.userId !== userId) {
            throw new ForbiddenException(
              'Solo quien registró el pago puede anularlo.',
            );
          }
          const hasShare = payment.expenseShareId !== null;
          const hasAdjustment = payment.adjustmentId !== null;
          if (hasShare === hasAdjustment) {
            throw new BadRequestException(
              'El pago no tiene una obligación asociada válida.',
            );
          }

          const shareId =
            payment.expenseShareId ?? payment.adjustment?.expenseShareId;
          if (shareId === undefined || shareId === null) {
            throw new BadRequestException(
              'No se encontró la participación asociada al pago.',
            );
          }

          if (payment.adjustmentId !== null) {
            if (
              payment.adjustment === null ||
              payment.adjustment.expenseId !== payment.expenseId ||
              payment.adjustment.expenseShareId !== shareId ||
              payment.adjustment.debtorMemberId !== payment.fromMemberId ||
              payment.adjustment.creditorMemberId !== payment.toMemberId ||
              payment.adjustment.amountCents !== payment.amountCents ||
              payment.adjustment.status !== 'PAID' ||
              payment.adjustment.settledByMemberId !== payment.fromMemberId
            ) {
              throw new ConflictException(
                'El ajuste ya no coincide con el pago confirmado.',
              );
            }
          }

          const share = await tx.expenseShare.findUnique({
            where: { id: shareId },
            include: { payment: true, adjustments: true },
          });
          if (!share || share.expenseId !== payment.expenseId) {
            throw new ConflictException(
              'La participación asociada al pago ya no es válida.',
            );
          }
          if (
            payment.expenseShareId !== null &&
            share.memberId !== payment.fromMemberId
          ) {
            throw new ConflictException(
              'El pago no corresponde al miembro de la participación.',
            );
          }

          const expense = await tx.expense.findUnique({
            where: { id: payment.expenseId },
            select: { payerMemberId: true },
          });
          if (!expense) {
            throw new ConflictException(
              'El gasto asociado al pago ya no está disponible.',
            );
          }
          if (
            payment.expenseShareId !== null &&
            payment.toMemberId !== expense.payerMemberId
          ) {
            throw new ConflictException(
              'El destinatario del pago ya no coincide con el pagador del gasto.',
            );
          }

          const deletedPayment = await tx.expensePayment.deleteMany({
            where: { id: paymentId },
          });
          if (deletedPayment.count !== 1) {
            throw new ConflictException(
              'El pago cambió durante la anulación. Volvé a cargar la cuenta e intentá nuevamente.',
            );
          }

          if (payment.adjustmentId !== null) {
            const reopenedAdjustment = await tx.expenseAdjustment.updateMany({
              where: {
                id: payment.adjustmentId,
                status: 'PAID',
                settledByMemberId: payment.fromMemberId,
              },
              data: {
                status: 'PENDING',
                settledByMemberId: null,
                settledAt: null,
              },
            });
            if (reopenedAdjustment.count !== 1) {
              throw new ConflictException(
                'No se pudo reabrir el ajuste asociado al pago.',
              );
            }
          }

          const updatedShare = await tx.expenseShare.findUnique({
            where: { id: shareId },
            include: { payment: true, adjustments: true },
          });
          if (!updatedShare) {
            throw new ConflictException(
              'La participación asociada al pago ya no está disponible.',
            );
          }

          await this.reconcileExpenseShareAdjustments(
            tx,
            payment.expenseId,
            updatedShare,
            updatedShare.isCurrent,
            updatedShare.isCurrent ? updatedShare.amountCents : 0,
            expense.payerMemberId,
          );

          return {
            kind:
              payment.adjustmentId === null ? 'EXPENSE_SHARE' : 'ADJUSTMENT',
            id: payment.id,
            expenseId: payment.expenseId,
            expenseShareId: shareId,
            adjustmentId: payment.adjustmentId,
            fromMemberId: payment.fromMemberId,
            toMemberId: payment.toMemberId,
            amountCents: payment.amountCents,
            createdAt: payment.createdAt,
            confirmedAt: payment.confirmedAt,
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
          'El pago o sus obligaciones cambiaron durante la anulación. Volvé a cargar la cuenta e intentá nuevamente.',
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

    const [expenses, payments, adjustments] = await Promise.all([
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
              isCurrent: true,
              payment: { select: { id: true } },
              adjustments: { select: { status: true } },
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
          adjustment: { select: { expenseShareId: true } },
        },
        orderBy: { createdAt: 'asc' },
      }),
      client.expenseAdjustment.findMany({
        where: {
          expense: {
            expenseAccountId: { in: accountIds },
            account: { deletedAt: null },
          },
        },
        include: {
          expense: { select: { expenseAccountId: true, title: true } },
        },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
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
        createdByUserId: expense.createdByUserId,
        shares: expense.shares.map((share) => ({
          memberId: share.memberId,
          amountCents: share.amountCents,
          isCurrent: share.isCurrent,
          isPaid:
            !share.isCurrent ||
            share.payment !== null ||
            share.adjustments.some(
              (adjustment) =>
                adjustment.status === 'PENDING' || adjustment.status === 'PAID',
            ) ||
            share.memberId === expense.payerMemberId,
        })),
        createdAt: expense.createdAt,
      });
      movementsByAccount.set(expense.expenseAccountId, movements);
    }

    for (const payment of payments) {
      const accountId = payment.expense.expenseAccountId;
      const movements = movementsByAccount.get(accountId) ?? [];
      const expenseShareId =
        payment.expenseShareId ?? payment.adjustment?.expenseShareId;
      const movement: AccountMovementData = {
        kind: 'PAYMENT',
        id: payment.id,
        expenseId: payment.expenseId,
        expenseTitle: payment.expense.title,
        amountCents: payment.amountCents,
        fromMemberId: payment.fromMemberId,
        toMemberId: payment.toMemberId,
        createdAt: payment.createdAt,
        confirmedAt: payment.confirmedAt,
        ...(expenseShareId == null ? {} : { expenseShareId }),
        ...(payment.adjustmentId === null
          ? {}
          : { adjustmentId: payment.adjustmentId }),
      };
      movements.push(movement);
      movementsByAccount.set(accountId, movements);
    }

    for (const adjustment of adjustments) {
      const accountId = adjustment.expense.expenseAccountId;
      const movements = movementsByAccount.get(accountId) ?? [];
      movements.push({
        kind: 'ADJUSTMENT',
        id: adjustment.id,
        expenseId: adjustment.expenseId,
        expenseShareId: adjustment.expenseShareId,
        expenseTitle: adjustment.expense.title,
        debtorMemberId: adjustment.debtorMemberId,
        creditorMemberId: adjustment.creditorMemberId,
        amountCents: adjustment.amountCents,
        status: adjustment.status,
        settledByMemberId: adjustment.settledByMemberId,
        createdAt: adjustment.createdAt,
        settledAt: adjustment.settledAt,
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
