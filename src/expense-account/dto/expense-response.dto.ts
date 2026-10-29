import type { ExpenseSplitType } from '@prisma/client';

export class ExpenseShareResponseDto {
  memberId!: number;
  amountCents!: number;
  isCurrent!: boolean;
}

export class ExpenseResponseDto {
  id!: number;
  expenseAccountId!: number;
  title!: string | null;
  amountCents!: number;
  splitType!: ExpenseSplitType;
  payerMemberId!: number;
  createdByUserId!: number | null;
  lastEditedByUserId!: number | null;
  lastEditedAt!: Date | null;
  shares!: ExpenseShareResponseDto[];
  createdAt!: Date;
}
