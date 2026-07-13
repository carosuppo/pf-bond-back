export class PointOfInterestResponseDto {
  id!: number;
  groupId!: number;
  name!: string;
  description!: string | null;
  latitude!: number;
  longitude!: number;
  radius!: number;
  createdByUserId!: number;
  createdAt!: Date;
  updatedAt!: Date;
}
