import { ExpenseAccountEntity } from '../entity/expense-account.entity';
import {
  ExpenseAccountDetailEntity,
  MyExpenseAccountData,
} from '../entity/expense-account-detail.entity';
import { ExpenseEntity } from '../entity/expense.entity';
import {
  ExpensePaymentEntity,
  PendingExpenseAdjustmentEntity,
  PendingExpenseShareEntity,
} from '../entity/expense-payment.entity';
import { CreateExpenseAccountData } from '../interface/create-expense-account.interface';
import { CreateExpenseData } from '../interface/create-expense.interface';
import { UpdateExpenseAccountData } from '../interface/update-expense-account.interface';
import type { AccountMovementData } from '../interface/account-movement.interface';

export interface ExpenseEventForValidation {
  id: number;
  groupId: number;
  deletedAt: Date | null;
}

export interface IExpenseAccountRepository {
  create(
    data: CreateExpenseAccountData,
    groupId: number,
    userId: number,
  ): Promise<ExpenseAccountEntity>;
  updateExpenseAccount(
    accountId: number,
    userId: number,
    data: UpdateExpenseAccountData,
  ): Promise<ExpenseAccountEntity>;
  findEventById(eventId: number): Promise<ExpenseEventForValidation | null>;
  findEventMemberIds(eventId: number): Promise<number[]>;
  findAccountsByUserId(userId: number): Promise<MyExpenseAccountData[]>;
  findAccountById(
    accountId: number,
  ): Promise<ExpenseAccountDetailEntity | null>;
  createExpense(
    data: CreateExpenseData,
    accountId: number,
    userId: number,
  ): Promise<ExpenseEntity>;
  updateExpense(
    accountId: number,
    expenseId: number,
    userId: number,
    data: CreateExpenseData,
  ): Promise<ExpenseEntity>;
  findPendingExpenseShares(
    accountId: number,
    memberId: number,
  ): Promise<PendingExpenseShareEntity[]>;
  findPendingExpenseAdjustments(
    accountId: number,
    memberId: number,
  ): Promise<PendingExpenseAdjustmentEntity[]>;
  registerExpensePayments(
    accountId: number,
    memberId: number,
    expenseShareIds: number[] | null,
    adjustmentIds: number[] | null,
  ): Promise<ExpensePaymentEntity[]>;
  annulExpensePayment(
    accountId: number,
    paymentId: number,
    userId: number,
  ): Promise<ExpensePaymentEntity>;
  deleteExpenseAccount(accountId: number, userId: number): Promise<void>;
  findMovementsByAccountId(accountId: number): Promise<AccountMovementData[]>;
}
