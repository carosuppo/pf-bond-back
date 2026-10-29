import type { ExpenseSplitType } from '@prisma/client';

export interface ExpenseShareEntity {
  memberId: number;
  amountCents: number;
  isCurrent: boolean;
}

export interface ExpenseEntity {
  id: number;
  expenseAccountId: number;
  title: string | null;
  amountCents: number;
  splitType: ExpenseSplitType;
  payerMemberId: number;
  createdByUserId: number | null;
  lastEditedByUserId: number | null;
  lastEditedAt: Date | null;
  shares: ExpenseShareEntity[];
  createdAt: Date;
}
