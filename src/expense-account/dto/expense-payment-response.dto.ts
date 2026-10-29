export class ExpensePaymentResponseDto {
  id!: number;
  expenseId!: number;
  expenseShareId!: number;
  fromMemberId!: number;
  toMemberId!: number;
  amountCents!: number;
  createdAt!: Date;
  confirmedAt!: Date;
}
