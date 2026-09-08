import { PointOfInterestColor } from '@prisma/client';
export class PointOfInterestResponseDto {
  color!: PointOfInterestColor;

  id!: number;

  name!: string;

  description!: string | null;

  radius!: number;

  latitude!: number;

  longitude!: number;

  groupId!: number;

  createdAt!: Date;
}
