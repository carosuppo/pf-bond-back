import { PointOfInterestColor } from '@prisma/client';
export interface UpdatePointOfInterestData {
  color?: PointOfInterestColor;
  name?: string;
  description?: string | null;
  radius?: number;
  latitude?: number;
  longitude?: number;
}
