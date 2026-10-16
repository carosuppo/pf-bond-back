import { ExpenseAccountEntity } from '../entity/expense-account.entity';
import {
  ExpenseAccountDetailEntity,
  MyExpenseAccountData,
} from '../entity/expense-account-detail.entity';
import { CreateExpenseAccountData } from '../interface/create-expense-account.interface';

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
}
