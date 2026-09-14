export interface EventEntity {
  id: number;
  name: string;
  description?: string | null;
  startAt: Date;
  endAt?: Date | null;
  groupId: number;
  memberIds: number[];
  location: {
    latitude: number;
    longitude: number;
  } | null;
}
