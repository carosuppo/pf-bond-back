import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';

import type { IGroupRepository } from '../group/repository/group.repository.interface';
import type { IMemberRepository } from '../member/repository/member.repository.interface';
import {
  POINT_OF_INTEREST_CREATED_EVENT,
  PointOfInterestCreatedEvent,
} from '../notification/events/point-of-interest-created.event';
import { CreatePointOfInterestDto } from './dto/create-point-of-interest.dto';
import { PointOfInterestResponseDto } from './dto/point-of-interest-response.dto';
import { UpdatePointOfInterestDto } from './dto/update-point-of-interest.dto';
import { PointOfInterestMapper } from './mapper/point-of-interest.mapper';
import type { PointOfInterestWithLocation } from './repository/point-of-interest.repository.interface';
import type { IPointOfInterestRepository } from './repository/point-of-interest.repository.interface';

@Injectable()
export class PointOfInterestService {
  constructor(
    @Inject('pointOfInterestRepository')
    private readonly pointOfInterestRepository: IPointOfInterestRepository,

    @Inject('memberRepository')
    private readonly memberRepository: IMemberRepository,

    @Inject('groupRepository')
    private readonly groupRepository: IGroupRepository,

    private readonly eventEmitter: EventEmitter2,
  ) {}

  async create(
    groupId: number,
    userId: number,
    dto: CreatePointOfInterestDto,
  ): Promise<PointOfInterestResponseDto> {
    await this.requireAccess(userId, groupId);

    const data = PointOfInterestMapper.toCreateData(dto, groupId);

    const pointOfInterest = await this.pointOfInterestRepository.create(data);

    this.eventEmitter.emit(
      POINT_OF_INTEREST_CREATED_EVENT,
      new PointOfInterestCreatedEvent(
        groupId,
        pointOfInterest.id,
        pointOfInterest.name,
        userId,
      ),
    );

    return PointOfInterestMapper.toResponse(pointOfInterest);
  }

  async getByGroup(
    groupId: number,
    userId: number,
  ): Promise<PointOfInterestResponseDto[]> {
    await this.requireAccess(userId, groupId);

    const points = await this.pointOfInterestRepository.findByGroupId(groupId);

    return points.map((point) => PointOfInterestMapper.toResponse(point));
  }

  async update(
    groupId: number,
    pointId: number,
    userId: number,
    dto: UpdatePointOfInterestDto,
  ): Promise<PointOfInterestResponseDto> {
    await this.requireAccess(userId, groupId);
    await this.requirePoint(groupId, pointId);

    const updated = await this.pointOfInterestRepository.update(
      pointId,
      PointOfInterestMapper.toUpdateData(dto),
    );

    return PointOfInterestMapper.toResponse(updated);
  }

  async remove(
    groupId: number,
    pointId: number,
    userId: number,
  ): Promise<void> {
    await this.requireAccess(userId, groupId);
    await this.requirePoint(groupId, pointId);
    await this.pointOfInterestRepository.softDelete(pointId);
  }

  private async requireAccess(userId: number, groupId: number): Promise<void> {
    const group = await this.groupRepository.findById(groupId);

    if (!group) {
      throw new NotFoundException('El grupo no existe o fue eliminado.');
    }

    await this.requireMembership(userId, groupId);
  }

  private async requirePoint(
    groupId: number,
    pointId: number,
  ): Promise<PointOfInterestWithLocation> {
    const point = await this.pointOfInterestRepository.findByIdAndGroupId(
      pointId,
      groupId,
    );

    if (!point) {
      throw new NotFoundException(
        'El punto de interés no existe, fue eliminado o pertenece a otro grupo.',
      );
    }

    return point;
  }

  private async requireMembership(
    userId: number,
    groupId: number,
  ): Promise<void> {
    const member = await this.memberRepository.findByUserAndGroup(
      userId,
      groupId,
    );

    if (!member) {
      throw new ForbiddenException('No perteneces a este grupo.');
    }
  }
}
