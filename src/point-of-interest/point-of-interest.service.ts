import { ForbiddenException, Inject, Injectable } from '@nestjs/common';

import type { IMemberRepository } from '../member/repository/member.repository.interface';
import { CreatePointOfInterestDto } from './dto/create-point-of-interest.dto';
import { PointOfInterestResponseDto } from './dto/point-of-interest-response.dto';
import { PointOfInterestMapper } from './mapper/point-of-interest.mapper';
import type { IPointOfInterestRepository } from './repository/point-of-interest.repository.interface';

@Injectable()
export class PointOfInterestService {
  constructor(
    @Inject('pointOfInterestRepository')
    private readonly pointOfInterestRepository: IPointOfInterestRepository,

    @Inject('memberRepository')
    private readonly memberRepository: IMemberRepository,
  ) {}

  async create(
    groupId: number,
    userId: number,
    dto: CreatePointOfInterestDto,
  ): Promise<PointOfInterestResponseDto> {
    await this.requireMembership(userId, groupId);

    const data = PointOfInterestMapper.toCreateData(dto, groupId);

    const pointOfInterest = await this.pointOfInterestRepository.create(data);

    return PointOfInterestMapper.toResponse(pointOfInterest);
  }

  async getByGroup(
    groupId: number,
    userId: number,
  ): Promise<PointOfInterestResponseDto[]> {
    await this.requireMembership(userId, groupId);

    const points = await this.pointOfInterestRepository.findByGroupId(groupId);

    return points.map((point) => PointOfInterestMapper.toResponse(point));
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
