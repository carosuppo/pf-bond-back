import type { ExpenseSplitType } from '@prisma/client';

export interface CreateExpenseShareData {
  memberId: number;
  amountCents: number;
}

export interface CreateExpenseData {
  title?: string | null;
  amountCents: number;
  payerMemberId: number;
  splitType: ExpenseSplitType;
  shares: CreateExpenseShareData[];
}
