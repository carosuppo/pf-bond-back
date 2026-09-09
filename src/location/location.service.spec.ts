import { PointOfInterestPresenceService } from '../point-of-interest/presence/point-of-interest-presence.service';
import { ConflictException, ForbiddenException } from '@nestjs/common';
import { GroupEventService } from '../group/group-event.service';
import { LocationService } from './location.service';
import type { ILocationRepository } from './repository/location.repository.interface';
import { SharingRecord } from './interface/location-record.interface';

describe('LocationService', () => {
  let service: LocationService;
  let repository: jest.Mocked<ILocationRepository>;
  let events: GroupEventService;

  const sharing: SharingRecord = {
    memberId: 10,
    groupId: 20,
    userId: 1,
    userName: 'Alice',
    locationSharingEnabled: true,
    shareLocationMandatorily: false,
    currentLocation: null,
  };

  beforeEach(() => {
    repository = {
      updateLastSeen: jest.fn(),
      upsertCurrentLocation: jest.fn(),
      findSharingByUser: jest.fn(),
      findSharingByUserAndGroup: jest.fn(),
      updateMemberSharing: jest.fn(),
      findVisibleMembers: jest.fn(),
    };
    events = new GroupEventService();
    service = new LocationService(repository, events, {
      evaluate: jest.fn().mockResolvedValue(undefined),
    } as unknown as PointOfInterestPresenceService);
  });

  it('updates the current location and publishes it only to effective groups', async () => {
    const mandatory = {
      ...sharing,
      memberId: 11,
      groupId: 21,
      locationSharingEnabled: false,
      shareLocationMandatorily: true,
    };
    const disabled = {
      ...sharing,
      memberId: 12,
      groupId: 22,
      locationSharingEnabled: false,
    };
    const location = {
      latitude: -34.6,
      longitude: -58.4,
      accuracy: 5,
      capturedAt: new Date(),
    };
    repository.findSharingByUser.mockResolvedValue([
      sharing,
      mandatory,
      disabled,
    ]);
    repository.upsertCurrentLocation.mockResolvedValue(location);
    const published: number[] = [];
    events.events$.subscribe((event) => published.push(event.data.groupId));

    await service.updateCurrentLocation(1, location);

    expect(repository.upsertCurrentLocation.mock.calls).toEqual([
      [1, location],
    ]);
    expect(published).toEqual([20, 21]);
  });

  it('rejects location updates when no group has effective sharing', async () => {
    repository.findSharingByUser.mockResolvedValue([
      { ...sharing, locationSharingEnabled: false },
    ]);
    await expect(
      service.updateCurrentLocation(1, { latitude: 1, longitude: 1 }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(repository.upsertCurrentLocation.mock.calls).toHaveLength(0);
  });

  it('rejects disabling sharing in a mandatory group', async () => {
    repository.findSharingByUserAndGroup.mockResolvedValue({
      ...sharing,
      shareLocationMandatorily: true,
    });
    await expect(
      service.updateGroupSharing(1, 20, false),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(repository.updateMemberSharing.mock.calls).toHaveLength(0);
  });

  it('emits removal when sharing is disabled', async () => {
    repository.findSharingByUserAndGroup.mockResolvedValue(sharing);
    const published: string[] = [];
    events.events$.subscribe((event) => published.push(event.event));
    await service.updateGroupSharing(1, 20, false);
    expect(repository.updateMemberSharing.mock.calls).toEqual([[10, false]]);
    expect(published).toEqual(['memberLocationRemoved']);
  });

  it('rejects querying a group the user does not belong to', async () => {
    repository.findSharingByUserAndGroup.mockResolvedValue(null);
    await expect(service.getGroupMembers(1, 99)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(repository.findVisibleMembers.mock.calls).toHaveLength(0);
  });

  it('returns only the visible members supplied by the repository as response DTOs', async () => {
    repository.findSharingByUserAndGroup.mockResolvedValue(sharing);
    repository.findVisibleMembers.mockResolvedValue([
      {
        memberId: 30,
        userId: 3,
        name: 'Bob',
        location: {
          latitude: 1,
          longitude: 2,
          accuracy: null,
          capturedAt: null,
        },
      },
    ]);
    await expect(service.getGroupMembers(1, 20)).resolves.toEqual([
      {
        memberId: 30,
        userId: 3,
        name: 'Bob',
        latitude: 1,
        longitude: 2,
        accuracy: null,
        capturedAt: null,
      },
    ]);
  });
});
