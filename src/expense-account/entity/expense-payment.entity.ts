export interface ExpensePaymentEntity {
  kind: 'EXPENSE_SHARE' | 'ADJUSTMENT';
  id: number;
  expenseId: number;
  expenseShareId: number;
  adjustmentId: number | null;
  fromMemberId: number;
  toMemberId: number;
  amountCents: number;
  createdAt: Date;
  confirmedAt: Date;
}

export interface PendingExpenseAdjustmentEntity {
  adjustmentId: number;
  expenseId: number;
  expenseShareId: number;
  expenseTitle: string | null;
  debtorMemberId: number;
  creditorMemberId: number;
  amountCents: number;
  createdAt: Date;
}

export interface PendingExpenseShareEntity {
  expenseShareId: number;
  expenseId: number;
  expenseTitle: string | null;
  payerMemberId: number;
  amountCents: number;
  createdAt: Date;
}
