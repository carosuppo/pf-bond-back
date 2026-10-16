export interface ExpenseShareData {
  memberId: number;
  amountCents: number;
}

export interface ExpenseMovementData {
  kind: 'EXPENSE';
  payerMemberId: number;
  shares: ExpenseShareData[];
}

export interface PaymentMovementData {
  kind: 'PAYMENT';
  fromMemberId: number;
  toMemberId: number;
  amountCents: number;
}

export type AccountMovementData = ExpenseMovementData | PaymentMovementData;
