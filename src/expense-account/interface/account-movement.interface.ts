export interface ExpenseShareData {
  memberId: number;
  amountCents: number;
  isPaid?: boolean;
  isCurrent?: boolean;
}

export interface ExpenseMovementData {
  kind: 'EXPENSE';
  id: number;
  title: string | null;
  amountCents: number;
  payerMemberId: number;
  shares: ExpenseShareData[];
  createdAt: Date;
}

export interface PaymentMovementData {
  kind: 'PAYMENT';
  id: number;
  amountCents: number;
  fromMemberId: number;
  toMemberId: number;
  createdAt: Date;
  expenseId?: number;
  expenseShareId?: number;
  expenseTitle?: string | null;
  confirmedAt?: Date;
}

export interface ExpenseAdjustmentMovementData {
  kind: 'ADJUSTMENT';
  id: number;
  expenseId: number;
  expenseShareId: number;
  expenseTitle: string | null;
  debtorMemberId: number;
  creditorMemberId: number;
  amountCents: number;
  status: 'PENDING' | 'PAID' | 'CANCELED';
  settledByMemberId: number | null;
  createdAt: Date;
  settledAt: Date | null;
}

export type AccountMovementData =
  ExpenseMovementData | PaymentMovementData | ExpenseAdjustmentMovementData;
