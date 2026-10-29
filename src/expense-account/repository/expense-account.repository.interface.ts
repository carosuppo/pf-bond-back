import { ExpenseAccountEntity } from '../entity/expense-account.entity';
import {
  ExpenseAccountDetailEntity,
  MyExpenseAccountData,
} from '../entity/expense-account-detail.entity';
import { ExpenseEntity } from '../entity/expense.entity';
import {
  ExpensePaymentEntity,
  PendingExpenseShareEntity,
} from '../entity/expense-payment.entity';
import { CreateExpenseAccountData } from '../interface/create-expense-account.interface';
import { CreateExpenseData } from '../interface/create-expense.interface';
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
  findEventById(eventId: number): Promise<ExpenseEventForValidation | null>;
  findEventMemberIds(eventId: number): Promise<number[]>;
  findAccountsByUserId(userId: number): Promise<MyExpenseAccountData[]>;
  findAccountById(
    accountId: number,
  ): Promise<ExpenseAccountDetailEntity | null>;
  createExpense(
    data: CreateExpenseData,
    accountId: number,
  ): Promise<ExpenseEntity>;
  findPendingExpenseShares(
    accountId: number,
    memberId: number,
  ): Promise<PendingExpenseShareEntity[]>;
  registerExpensePayments(
    accountId: number,
    memberId: number,
    expenseShareIds: number[] | null,
  ): Promise<ExpensePaymentEntity[]>;
  findMovementsByAccountId(accountId: number): Promise<AccountMovementData[]>;
}
