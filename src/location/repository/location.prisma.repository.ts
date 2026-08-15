import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  LocationData,
  LocationRecord,
  SharingRecord,
  VisibleMemberLocationRecord,
} from '../interface/location-record.interface';
import { ILocationRepository } from './location.repository.interface';

@Injectable()
export class LocationPrismaRepository implements ILocationRepository {
  constructor(private readonly prismaService: PrismaService) {}

  async upsertCurrentLocation(
    userId: number,
    data: LocationData,
  ): Promise<LocationRecord> {
    return this.prismaService.$transaction(async (transaction) => {
      const user = await transaction.user.findUniqueOrThrow({
        where: { id: userId },
        select: { locationId: true },
      });

      const now = new Date();

      const locationData = {
        latitude: data.latitude,
        longitude: data.longitude,
        accuracy: data.accuracy ?? null,
        capturedAt: data.capturedAt ?? null,
        lastSeenAt: now,
      };

      if (user.locationId) {
        return transaction.location.update({
          where: {
            id: user.locationId,
          },
          data: locationData,
        });
      }

      const location = await transaction.location.create({
        data: locationData,
      });

      await transaction.user.update({
        where: {
          id: userId,
        },
        data: {
          locationId: location.id,
        },
      });

      return location;
    });
  }

  async updateLastSeen(userId: number, lastSeenAt: Date): Promise<boolean> {
    const user = await this.prismaService.user.findUnique({
      where: {
        id: userId,
      },
      select: {
        locationId: true,
      },
    });

    if (!user?.locationId) {
      return false;
    }

    await this.prismaService.location.update({
      where: {
        id: user.locationId,
      },
      data: {
        lastSeenAt,
      },
    });

    return true;
  }

  async findSharingByUser(userId: number): Promise<SharingRecord[]> {
    const members = await this.prismaService.member.findMany({
      where: {
        userId,
        user: {
          deletedAt: null,
        },
        group: {
          deletedAt: null,
        },
      },
      include: {
        group: true,
        user: {
          include: {
            currentLocation: true,
          },
        },
      },
    });

    return members.map((member) => this.toSharingRecord(member));
  }

  async findSharingByUserAndGroup(
    userId: number,
    groupId: number,
  ): Promise<SharingRecord | null> {
    const member = await this.prismaService.member.findFirst({
      where: {
        userId,
        groupId,
        user: {
          deletedAt: null,
        },
        group: {
          deletedAt: null,
        },
      },
      include: {
        group: true,
        user: {
          include: {
            currentLocation: true,
          },
        },
      },
    });

    return member ? this.toSharingRecord(member) : null;
  }

  async updateMemberSharing(memberId: number, enabled: boolean): Promise<void> {
    await this.prismaService.member.update({
      where: {
        id: memberId,
      },
      data: {
        locationSharingEnabled: enabled,
      },
    });
  }

  async findVisibleMembers(
    groupId: number,
    excludedUserId: number,
  ): Promise<VisibleMemberLocationRecord[]> {
    const members = await this.prismaService.member.findMany({
      where: {
        groupId,
        userId: {
          not: excludedUserId,
        },
        user: {
          deletedAt: null,
          currentLocation: {
            isNot: null,
          },
        },
        group: {
          deletedAt: null,
        },
        OR: [
          {
            locationSharingEnabled: true,
          },
          {
            group: {
              shareLocationMandatorily: true,
            },
          },
        ],
      },
      include: {
        user: {
          include: {
            currentLocation: true,
          },
        },
      },
    });

    return members.flatMap((member) =>
      member.user.currentLocation
        ? [
            {
              memberId: member.id,
              userId: member.userId,
              name: member.user.name,
              location: member.user.currentLocation,
            },
          ]
        : [],
    );
  }

  private toSharingRecord(member: {
    id: number;
    groupId: number;
    userId: number;
    locationSharingEnabled: boolean;

    group: {
      shareLocationMandatorily: boolean;
    };

    user: {
      name: string;
      currentLocation: LocationRecord | null;
    };
  }): SharingRecord {
    return {
      memberId: member.id,
      groupId: member.groupId,
      userId: member.userId,
      userName: member.user.name,
      locationSharingEnabled: member.locationSharingEnabled,
      shareLocationMandatorily: member.group.shareLocationMandatorily,
      currentLocation: member.user.currentLocation,
    };
  }
}
