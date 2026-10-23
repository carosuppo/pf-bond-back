export class ExpenseAccountResponseDto {
  id!: number;
  name!: string;
  groupId!: number;
  eventId?: number | null;
  memberIds!: number[];
}
