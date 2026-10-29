import type { AccountMovementData } from '../interface/account-movement.interface';

export interface ExpenseAccountDetailEntity {
  id: number;
  name: string;
  groupId: number;
  createdByUserId: number | null;
  groupName: string;
  eventId: number | null;
  eventName: string | null;
  memberIds: number[];
  movements: AccountMovementData[];
}

export interface MyExpenseAccountData extends ExpenseAccountDetailEntity {
  myMemberId: number;
}
