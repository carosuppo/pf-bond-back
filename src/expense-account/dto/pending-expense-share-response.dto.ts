export class PendingExpenseShareResponseDto {
  expenseShareId!: number;
  expenseId!: number;
  expenseTitle!: string | null;
  payerMemberId!: number;
  amountCents!: number;
  createdAt!: Date;
}
