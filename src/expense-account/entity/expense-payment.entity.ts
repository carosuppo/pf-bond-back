export interface ExpensePaymentEntity {
  id: number;
  expenseId: number;
  expenseShareId: number;
  fromMemberId: number;
  toMemberId: number;
  amountCents: number;
  createdAt: Date;
  confirmedAt: Date;
}

export interface PendingExpenseShareEntity {
  expenseShareId: number;
  expenseId: number;
  expenseTitle: string | null;
  payerMemberId: number;
  amountCents: number;
  createdAt: Date;
}
