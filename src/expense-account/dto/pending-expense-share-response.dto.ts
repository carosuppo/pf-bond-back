export class PendingExpenseShareResponseDto {
  kind!: 'EXPENSE_SHARE';
  expenseShareId!: number;
  expenseId!: number;
  expenseTitle!: string | null;
  payerMemberId!: number;
  amountCents!: number;
  createdAt!: Date;
}
