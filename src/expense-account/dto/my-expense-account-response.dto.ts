import type { BalanceStatus } from '../balance/expense-account-balance.calculator';

export class MyExpenseAccountResponseDto {
  id!: number;
  name!: string;
  groupId!: number;
  groupName!: string;
  eventId!: number | null;
  eventName!: string | null;
  balanceCents!: number;
  status!: BalanceStatus;
}
