export interface ExpenseAccountEntity {
  id: number;
  name: string;
  groupId: number;
  eventId?: number | null;
  memberIds: number[];
}
