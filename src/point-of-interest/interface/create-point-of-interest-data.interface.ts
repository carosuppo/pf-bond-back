import { PointOfInterestColor, PointOfInterestValidity } from '@prisma/client';
export interface CreatePointOfInterestData {
  color: PointOfInterestColor;
  name: string;
  radius: number;
  latitude: number;
  longitude: number;
  groupId: number;
  validity: PointOfInterestValidity;
  endTime: Date | null;
}
