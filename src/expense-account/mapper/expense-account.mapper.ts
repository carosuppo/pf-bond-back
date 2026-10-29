import { CreateExpenseAccountDto } from '../dto/create-expense-account.dto';
import { ExpenseAccountDetailResponseDto } from '../dto/expense-account-detail-response.dto';
import { ExpenseAccountResponseDto } from '../dto/expense-account-response.dto';
import { ExpenseResponseDto } from '../dto/expense-response.dto';
import { MyExpenseAccountResponseDto } from '../dto/my-expense-account-response.dto';
import { PendingExpenseAdjustmentResponseDto } from '../dto/pending-expense-adjustment-response.dto';
import { ExpensePaymentResponseDto } from '../dto/expense-payment-response.dto';
import { PendingExpenseShareResponseDto } from '../dto/pending-expense-share-response.dto';
import { ExpenseEntity } from '../entity/expense.entity';
import {
  ExpensePaymentEntity,
  PendingExpenseAdjustmentEntity,
  PendingExpenseShareEntity,
} from '../entity/expense-payment.entity';
import {
  calculateBalances,
  calculateDebtsOfMember,
  calculateDebtsToMember,
  toBalanceStatus,
} from '../balance/expense-account-balance.calculator';
import {
  ExpenseAccountDetailEntity,
  MyExpenseAccountData,
} from '../entity/expense-account-detail.entity';
import { ExpenseAccountEntity } from '../entity/expense-account.entity';
import { CreateExpenseAccountData } from '../interface/create-expense-account.interface';

export class ExpenseAccountMapper {
  static toResponse(
    expenseAccount: ExpenseAccountEntity,
  ): ExpenseAccountResponseDto {
    return {
      id: expenseAccount.id,
      name: expenseAccount.name,
      groupId: expenseAccount.groupId,
      eventId: expenseAccount.eventId ?? null,
      memberIds: expenseAccount.memberIds,
    };
  }

  static toCreatePersistence(
    createExpenseAccountDto: CreateExpenseAccountDto,
    memberIds: number[],
  ): CreateExpenseAccountData {
    return {
      name: createExpenseAccountDto.name,
      eventId: createExpenseAccountDto.eventId ?? null,
      memberIds,
    };
  }

  static toMyAccountResponse(
    account: MyExpenseAccountData,
  ): MyExpenseAccountResponseDto {
    const balances = calculateBalances(account.memberIds, account.movements);
    const myBalance =
      balances.find((balance) => balance.memberId === account.myMemberId)
        ?.balanceCents ?? 0;

    return {
      id: account.id,
      name: account.name,
      groupId: account.groupId,
      groupName: account.groupName,
      eventId: account.eventId,
      eventName: account.eventName,
      balanceCents: myBalance,
      status: toBalanceStatus(myBalance),
    };
  }

  static toDetailResponse(
    account: ExpenseAccountDetailEntity,
    myMemberId: number,
  ): ExpenseAccountDetailResponseDto {
    const balances = calculateBalances(account.memberIds, account.movements);
    const myBalance =
      balances.find((balance) => balance.memberId === myMemberId)
        ?.balanceCents ?? 0;

    return {
      id: account.id,
      name: account.name,
      groupId: account.groupId,
      createdByUserId: account.createdByUserId,
      groupName: account.groupName,
      eventId: account.eventId,
      eventName: account.eventName,
      members: balances,
      myMemberId,
      myBalanceCents: myBalance,
      myStatus: toBalanceStatus(myBalance),
      debtsToMe: calculateDebtsToMember(account.movements, myMemberId),
      myDebts: calculateDebtsOfMember(account.movements, myMemberId),
      movements: account.movements,
    };
  }

  static toExpenseResponse(expense: ExpenseEntity): ExpenseResponseDto {
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

  static toPendingExpenseShareResponse(
    share: PendingExpenseShareEntity,
  ): PendingExpenseShareResponseDto {
    return { kind: 'EXPENSE_SHARE', ...share };
  }

  static toPendingExpenseAdjustmentResponse(
    adjustment: PendingExpenseAdjustmentEntity,
  ): PendingExpenseAdjustmentResponseDto {
    return { kind: 'ADJUSTMENT', ...adjustment };
  }

  static toExpensePaymentResponse(
    payment: ExpensePaymentEntity,
  ): ExpensePaymentResponseDto {
    return { ...payment };
  }
}
