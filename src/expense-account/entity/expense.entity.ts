import type { ExpenseSplitType } from '@prisma/client';

export interface ExpenseShareEntity {
  memberId: number;
  amountCents: number;
}

export interface ExpenseEntity {
  id: number;
  expenseAccountId: number;
  title: string | null;
  amountCents: number;
  splitType: ExpenseSplitType;
  payerMemberId: number;
  shares: ExpenseShareEntity[];
  createdAt: Date;
}
