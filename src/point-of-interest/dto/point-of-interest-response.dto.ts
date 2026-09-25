import { PointOfInterestColor, PointOfInterestValidity } from '@prisma/client';
export class PointOfInterestResponseDto {
  color!: PointOfInterestColor;

  id!: number;

  name!: string;

  radius!: number;

  latitude!: number;

  longitude!: number;

  groupId!: number;

  createdAt!: Date;

  validity!: PointOfInterestValidity;

  endTime!: Date | null;
}
