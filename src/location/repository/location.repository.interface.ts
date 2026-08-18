import {
  LocationData,
  LocationRecord,
  SharingRecord,
  VisibleMemberLocationRecord,
} from '../interface/location-record.interface';

export interface ILocationRepository {
  upsertCurrentLocation(
    userId: number,
    data: LocationData,
  ): Promise<LocationRecord>;

  updateLastSeen(userId: number, lastSeenAt: Date): Promise<boolean>;

  findSharingByUser(userId: number): Promise<SharingRecord[]>;

  findSharingByUserAndGroup(
    userId: number,
    groupId: number,
  ): Promise<SharingRecord | null>;

  updateMemberSharing(memberId: number, enabled: boolean): Promise<void>;

  findVisibleMembers(
    groupId: number,
    excludedUserId: number,
  ): Promise<VisibleMemberLocationRecord[]>;
}
