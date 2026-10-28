import type { ExpenseSplitType } from '@prisma/client';

export class ExpenseShareResponseDto {
  memberId!: number;
  amountCents!: number;
}

export class ExpenseResponseDto {
  id!: number;
  expenseAccountId!: number;
  title!: string | null;
  amountCents!: number;
  splitType!: ExpenseSplitType;
  payerMemberId!: number;
  shares!: ExpenseShareResponseDto[];
  createdAt!: Date;
}
