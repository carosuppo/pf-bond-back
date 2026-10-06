export interface CreateExpenseAccountData {
  name: string;
  eventId?: number | null;
  memberIds: number[];
}
