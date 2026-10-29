export class ExpensePaymentResponseDto {
  kind!: 'EXPENSE_SHARE' | 'ADJUSTMENT';
  id!: number;
  expenseId!: number;
  expenseShareId!: number;
  adjustmentId!: number | null;
  fromMemberId!: number;
  toMemberId!: number;
  amountCents!: number;
  createdAt!: Date;
  confirmedAt!: Date;
}
