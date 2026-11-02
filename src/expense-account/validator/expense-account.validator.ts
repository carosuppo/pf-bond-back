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

  async requireAccountMembership(accountId: number, userId: number) {
    const account =
      await this.expenseAccountRepository.findAccountById(accountId);

    if (!account) {
      throw new NotFoundException('La cuenta no existe.');
    }

    const member = await this.memberRepository.findByUserAndGroup(
      userId,
      account.groupId,
    );

    if (!member || !account.memberIds.includes(member.id)) {
      throw new ForbiddenException('No estás asociado a esta cuenta.');
    }

    return { account, member };
  }

  validateExpenseParticipants(
    accountMemberIds: number[],
    payerMemberId: number,
    participantIds: number[],
  ): void {
    if (!accountMemberIds.includes(payerMemberId)) {
      throw new BadRequestException('El pagador no pertenece a la cuenta.');
    }

    const invalidMemberIds = [...new Set(participantIds)].filter(
      (memberId) => !accountMemberIds.includes(memberId),
    );

    if (invalidMemberIds.length > 0) {
      throw new BadRequestException(
        `Los siguientes miembros no pertenecen a la cuenta: ${invalidMemberIds.join(', ')}`,
      );
    }
  }

  validateCustomSharesTotal(
    totalCents: number,
    shares: { memberId: number; amountCents: number }[],
  ): void {
    const memberIds = shares.map((share) => share.memberId);
    const duplicatedIds = memberIds.filter(
      (memberId, index) => memberIds.indexOf(memberId) !== index,
    );

    if (duplicatedIds.length > 0) {
      throw new BadRequestException(
        `El reparto tiene miembros duplicados: ${[...new Set(duplicatedIds)].join(', ')}`,
      );
    }

    const assignedCents = shares.reduce(
      (sum, share) => sum + share.amountCents,
      0,
    );

    if (assignedCents !== totalCents) {
      throw new BadRequestException({
        message:
          'La suma de los importes asignados no coincide con el total del gasto.',
        totalCents,
        assignedCents,
        differenceCents: totalCents - assignedCents,
      });
    }
  }
}
