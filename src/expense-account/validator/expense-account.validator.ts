import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import type { IGroupRepository } from '../../group/repository/group.repository.interface';
import type { IMemberRepository } from '../../member/repository/member.repository.interface';
import type { IExpenseAccountRepository } from '../repository/expense-account.repository.interface';

@Injectable()
export class ExpenseAccountValidator {
  constructor(
    @Inject('expenseAccountRepository')
    private readonly expenseAccountRepository: IExpenseAccountRepository,
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

  async requireEventInGroup(eventId: number, groupId: number) {
    const event = await this.expenseAccountRepository.findEventById(eventId);

    if (!event || event.deletedAt) {
      throw new NotFoundException('El evento no existe.');
    }

    if (event.groupId !== groupId) {
      throw new BadRequestException('El evento pertenece a otro grupo.');
    }

    return event;
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

  async validateMembersBelongToEvent(
    memberIds: number[],
    eventId: number,
  ): Promise<void> {
    const eventMemberIds =
      await this.expenseAccountRepository.findEventMemberIds(eventId);

    const invalidMemberIds = memberIds.filter(
      (memberId) => !eventMemberIds.includes(memberId),
    );

    if (invalidMemberIds.length > 0) {
      throw new BadRequestException(
        `Los siguientes miembros no pertenecen al evento: ${invalidMemberIds.join(', ')}`,
      );
    }
  }
}
