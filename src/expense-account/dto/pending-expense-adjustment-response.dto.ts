export class PendingExpenseAdjustmentResponseDto {
  kind!: 'ADJUSTMENT';
  adjustmentId!: number;
  expenseId!: number;
  expenseShareId!: number;
  expenseTitle!: string | null;
  debtorMemberId!: number;
  creditorMemberId!: number;
  amountCents!: number;
  createdAt!: Date;
}
