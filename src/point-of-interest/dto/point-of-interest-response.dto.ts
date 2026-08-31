export class PointOfInterestResponseDto {
  id!: number;

  name!: string;

  description!: string | null;

  radius!: number;

  latitude!: number;

  longitude!: number;

  groupId!: number;

  createdAt!: Date;
}
