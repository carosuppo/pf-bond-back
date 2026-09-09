export class EventResponseDto {
  id!: number;
  name!: string;
  description?: string | null;
  startAt!: Date;
  endAt?: Date | null;
  memberIds!: number[];
}
