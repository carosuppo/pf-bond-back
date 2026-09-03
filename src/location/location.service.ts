import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
} from '@nestjs/common';
import { GroupEventService } from '../group/group-event.service';

import { CurrentLocationResponseDto } from './dto/current-location-response.dto';

import { LocationHeartbeatResponseDto } from './dto/location-heartbeat-response.dto';

import { LocationSharingResponseDto } from './dto/location-sharing-response.dto';

import { MemberLocationResponseDto } from './dto/member-location-response.dto';

import { UpdateCurrentLocationDto } from './dto/update-current-location.dto';

import { SharingRecord } from './interface/location-record.interface';

import type { ILocationRepository } from './repository/location.repository.interface';

@Injectable()
export class LocationService {
  constructor(
    @Inject('locationRepository')
    private readonly locationRepository: ILocationRepository,

    private readonly groupEventService: GroupEventService,
  ) {}

  async updateCurrentLocation(
    userId: number,
    dto: UpdateCurrentLocationDto,
  ): Promise<CurrentLocationResponseDto> {
    const effectiveSharing = (
      await this.locationRepository.findSharingByUser(userId)
    ).filter((item) => this.isSharingEffective(item));

    if (effectiveSharing.length === 0) {
      throw new ForbiddenException(
        'No groups have effective location sharing enabled.',
      );
    }

    const location = await this.locationRepository.upsertCurrentLocation(
      userId,
      dto,
    );

    for (const item of effectiveSharing) {
      this.groupEventService.publish({
        event: 'memberLocationUpdated',

        data: {
          groupId: item.groupId,
          actorUserId: userId,
          memberId: item.memberId,
          userId: item.userId,
          name: item.userName,
          ...location,
        },
      });
    }

    return location;
  }

  async heartbeat(userId: number): Promise<LocationHeartbeatResponseDto> {
    const effectiveSharing = (
      await this.locationRepository.findSharingByUser(userId)
    ).filter((item) => this.isSharingEffective(item));

    if (effectiveSharing.length === 0) {
      throw new ForbiddenException(
        'No groups have effective location sharing enabled.',
      );
    }

    const lastSeenAt = new Date();

    const locationExists = await this.locationRepository.updateLastSeen(
      userId,
      lastSeenAt,
    );

    if (locationExists) {
      for (const item of effectiveSharing) {
        this.groupEventService.publish({
          event: 'memberLocationHeartbeat',

          data: {
            groupId: item.groupId,
            actorUserId: userId,
            memberId: item.memberId,
            userId: item.userId,
            lastSeenAt,
          },
        });
      }
    }

    return {
      lastSeenAt,
    };
  }

  async getSharing(userId: number): Promise<LocationSharingResponseDto[]> {
    const sharing = await this.locationRepository.findSharingByUser(userId);

    return sharing.map((item) => ({
      memberId: item.memberId,
      groupId: item.groupId,
      locationSharingEnabled: item.locationSharingEnabled,
      shareLocationMandatorily: item.shareLocationMandatorily,
      effectiveLocationSharing: this.isSharingEffective(item),
    }));
  }

  async updateGroupSharing(
    userId: number,
    groupId: number,
    enabled: boolean,
  ): Promise<LocationSharingResponseDto> {
    const sharing = await this.requireMembership(userId, groupId);

    if (sharing.shareLocationMandatorily && !enabled) {
      throw new ConflictException(
        'Location sharing is mandatory for this group.',
      );
    }

    await this.locationRepository.updateMemberSharing(
      sharing.memberId,
      enabled,
    );

    if (!enabled) {
      this.groupEventService.publish({
        event: 'memberLocationRemoved',

        data: {
          groupId,
          actorUserId: userId,
          memberId: sharing.memberId,
          userId,
        },
      });
    } else if (sharing.currentLocation) {
      this.groupEventService.publish({
        event: 'memberLocationUpdated',

        data: {
          groupId,
          actorUserId: userId,
          memberId: sharing.memberId,
          userId,
          name: sharing.userName,
          ...sharing.currentLocation,
        },
      });
    }

    return {
      memberId: sharing.memberId,
      groupId,
      locationSharingEnabled: enabled,

      shareLocationMandatorily: sharing.shareLocationMandatorily,

      effectiveLocationSharing: sharing.shareLocationMandatorily || enabled,
    };
  }

  async getGroupMembers(
    userId: number,
    groupId: number,
  ): Promise<MemberLocationResponseDto[]> {
    await this.requireMembership(userId, groupId);

    return (
      await this.locationRepository.findVisibleMembers(groupId, userId)
    ).map((member) => ({
      memberId: member.memberId,
      userId: member.userId,
      name: member.name,
      ...member.location,
    }));
  }

  async verifyGroupMembership(userId: number, groupId: number): Promise<void> {
    await this.requireMembership(userId, groupId);
  }

  private async requireMembership(
    userId: number,
    groupId: number,
  ): Promise<SharingRecord> {
    const sharing = await this.locationRepository.findSharingByUserAndGroup(
      userId,
      groupId,
    );

    if (!sharing) {
      throw new ForbiddenException('No perteneces a este grupo.');
    }

    return sharing;
  }

  private isSharingEffective(
    item: Pick<
      SharingRecord,
      'locationSharingEnabled' | 'shareLocationMandatorily'
    >,
  ): boolean {
    return item.shareLocationMandatorily || item.locationSharingEnabled;
  }
}
