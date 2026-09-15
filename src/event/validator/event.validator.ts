import {
  BadRequestException,
  ForbiddenException,
  Inject,
  NotFoundException,
} from '@nestjs/common';

import type { IGroupRepository } from '../../group/repository/group.repository.interface';
import type { IMemberRepository } from '../../member/repository/member.repository.interface';
import type { IEventRepository } from '../repository/event.repository.interface';

export class EventValidator {
  constructor(
    @Inject('eventRepository')
    private readonly eventRepository: IEventRepository,
    @Inject('memberRepository')
    private readonly memberRepository: IMemberRepository,
    @Inject('groupRepository')
    private readonly groupRepository: IGroupRepository,
  ) {}

  async existsGroup(groupId: number) {
    const group = await this.groupRepository.findById(groupId);

    if (!group) {
      throw new NotFoundException('El grupo no existe.');
    }
  }

  async requireMembership(userId: number, groupId: number) {
    const member = await this.memberRepository.findByUserAndGroup(
      userId,
      groupId,
    );
    if (!member) {
      throw new ForbiddenException('No perteneces a este grupo.');
    }
    return member;
  }

  async requireEventMembership(
    userId: number,
    groupId: number,
    eventId: number,
  ) {
    const member = await this.requireMembership(userId, groupId);
    const event = await this.eventRepository.findByIdAndMemberId(
      eventId,
      member.id,
    );
    if (!event) {
      throw new NotFoundException('El evento no existe.');
    }
    return event;
  }

  isFutureDate(date: Date): boolean {
    return date.getTime() > Date.now();
  }

  isAfterDate(date: Date, referenceDate: Date): boolean {
    return date.getTime() > referenceDate.getTime();
  }

  validateStartDate(date: Date): void {
    if (!this.isFutureDate(date)) {
      throw new BadRequestException(
        'La fecha de inicio debe ser posterior a la fecha actual.',
      );
    }
  }

  validateEndDate(endDate: Date | null | undefined, startDate: Date): void {
    if (endDate && !this.isAfterDate(endDate, startDate)) {
      throw new BadRequestException(
        'La fecha de finalización debe ser posterior a la fecha de inicio.',
      );
    }
  }

  async validateMembersBelongToGroup(
    memberIds: number[],
    groupId: number,
  ): Promise<void> {
    const existingMemberIds = await this.memberRepository.getMembersByIds(
      memberIds,
      groupId,
    );

    const invalidMemberIds = memberIds.filter(
      (memberId) => !existingMemberIds.includes(memberId),
    );

    if (invalidMemberIds.length > 0) {
      throw new BadRequestException(
        `Los siguientes miembros no pertenecen al grupo: ${invalidMemberIds.join(', ')}`,
      );
    }
  }
}
