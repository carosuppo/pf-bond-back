export interface CreatePointOfInterestData {
  name: string;
  description: string | null;
  radius: number;
  latitude: number;
  longitude: number;
  groupId: number;
}
