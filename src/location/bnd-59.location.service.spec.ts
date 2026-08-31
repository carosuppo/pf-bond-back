import { ForbiddenException } from '@nestjs/common';
import { LocationEventService } from './location-event.service';
import { LocationService } from './location.service';
import { SharingRecord } from './interface/location-record.interface';
import type { ILocationRepository } from './repository/location.repository.interface';

describe('BND-59 - Visualizar ubicación de miembros del grupo - LocationService', () => {
  let service: LocationService;
  let repository: jest.Mocked<ILocationRepository>;

  const membership: SharingRecord = {
    memberId: 10,
    groupId: 20,
    userId: 1,
    userName: 'Tomas',
    locationSharingEnabled: false,
    shareLocationMandatorily: false,
    currentLocation: null,
  };

  beforeEach(() => {
    repository = {
      upsertCurrentLocation: jest.fn(),
      updateLastSeen: jest.fn(),
      findSharingByUser: jest.fn(),
      findSharingByUserAndGroup: jest.fn(),
      updateMemberSharing: jest.fn(),
      findVisibleMembers: jest.fn(),
    };

    service = new LocationService(repository, new LocationEventService());
  });

  it('devuelve las ubicaciones visibles de los miembros del grupo', async () => {
    const lastSeenAt = new Date();

    repository.findSharingByUserAndGroup.mockResolvedValue(membership);

    repository.findVisibleMembers.mockResolvedValue([
      {
        memberId: 30,
        userId: 3,
        name: 'Juan',
        location: {
          latitude: -34.6037,
          longitude: -58.3816,
          accuracy: 5,
          capturedAt: new Date('2026-08-18T20:00:00Z'),
          lastSeenAt,
        },
      },
      {
        memberId: 31,
        userId: 4,
        name: 'Pedro',
        location: {
          latitude: -34.61,
          longitude: -58.39,
          accuracy: null,
          capturedAt: null,
          lastSeenAt,
        },
      },
    ]);

    const result = await service.getGroupMembers(1, 20);

    expect(result).toEqual([
      {
        memberId: 30,
        userId: 3,
        name: 'Juan',
        latitude: -34.6037,
        longitude: -58.3816,
        accuracy: 5,
        capturedAt: new Date('2026-08-18T20:00:00Z'),
        lastSeenAt,
      },
      {
        memberId: 31,
        userId: 4,
        name: 'Pedro',
        latitude: -34.61,
        longitude: -58.39,
        accuracy: null,
        capturedAt: null,
        lastSeenAt,
      },
    ]);

    expect(repository.findVisibleMembers).toHaveBeenCalledWith(20, 1);
  });

  it('devuelve una lista vacía si ningún miembro comparte ubicación', async () => {
    repository.findSharingByUserAndGroup.mockResolvedValue(membership);
    repository.findVisibleMembers.mockResolvedValue([]);

    const result = await service.getGroupMembers(1, 20);

    expect(result).toEqual([]);
  });

  it('rechaza visualizar un grupo al que el usuario no pertenece', async () => {
    repository.findSharingByUserAndGroup.mockResolvedValue(null);

    await expect(service.getGroupMembers(1, 99)).rejects.toBeInstanceOf(
      ForbiddenException,
    );

    expect(repository.findVisibleMembers).not.toHaveBeenCalled();
  });
});
