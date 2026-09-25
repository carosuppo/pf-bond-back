import { PointOfInterestColor, PointOfInterestValidity } from '@prisma/client';
export interface UpdatePointOfInterestData {
  color?: PointOfInterestColor;
  name?: string;
  radius?: number;
  latitude?: number;
  longitude?: number;
  validity?: PointOfInterestValidity;
  endTime?: Date | null;
}
