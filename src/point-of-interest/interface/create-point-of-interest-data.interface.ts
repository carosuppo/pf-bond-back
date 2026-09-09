import { PointOfInterestColor } from '@prisma/client';
export interface CreatePointOfInterestData {
  color: PointOfInterestColor;
  name: string;
  description: string | null;
  radius: number;
  latitude: number;
  longitude: number;
  groupId: number;
}
