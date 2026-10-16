import type { BalanceStatus } from '../balance/expense-account-balance.calculator';
import type { AccountMovementData } from '../interface/account-movement.interface';

export class AccountMemberBalanceDto {
  memberId!: number;
  balanceCents!: number;
  status!: BalanceStatus;
}

export class AccountDebtDto {
  memberId!: number;
  amountCents!: number;
}

export class ExpenseAccountDetailResponseDto {
  id!: number;
  name!: string;
  groupId!: number;
  groupName!: string;
  eventId!: number | null;
  eventName!: string | null;
  members!: AccountMemberBalanceDto[];
  myBalanceCents!: number;
  myStatus!: BalanceStatus;
  debtsToMe!: AccountDebtDto[];
  myDebts!: AccountDebtDto[];
  movements!: AccountMovementData[];
}
