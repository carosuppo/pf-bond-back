export interface LocationData {
  latitude: number;
  longitude: number;
  accuracy?: number;
  capturedAt?: Date;
}

export interface LocationRecord {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  capturedAt: Date | null;
  lastSeenAt: Date | null;
}

export interface SharingRecord {
  memberId: number;
  groupId: number;
  userId: number;
  userName: string;
  locationSharingEnabled: boolean;
  shareLocationMandatorily: boolean;
  currentLocation: LocationRecord | null;
}

export interface VisibleMemberLocationRecord {
  memberId: number;
  userId: number;
  name: string;
  location: LocationRecord;
}
