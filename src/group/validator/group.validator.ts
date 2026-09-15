import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { RoleEnum } from '@prisma/client';
import type { IMemberRepository } from '../../member/repository/member.repository.interface';
import type { IGroupRepository } from '../repository/group.repository.interface';

@Injectable()
export class GroupValidator {
  constructor(
    @Inject('groupRepository')
    private readonly groupRepository: IGroupRepository,
    @Inject('memberRepository')
    private readonly memberRepository: IMemberRepository,
  ) {}

  async existGroup(id: number): Promise<boolean> {
    const group = await this.groupRepository.findById(id);

    if (!group) {
      throw new NotFoundException('El grupo no existe.');
    }

    return true;
  }

  async isGroupMember(userId: number, groupId: number): Promise<boolean> {
    const member = await this.memberRepository.findByUserAndGroup(
      userId,
      groupId,
    );

    if (!member) {
      throw new ForbiddenException('No perteneces a este grupo.');
    }

    return true;
  }

  async isAdmin(userId: number, groupId: number): Promise<boolean> {
    const member = await this.memberRepository.findByUserAndGroup(
      userId,
      groupId,
    );

    if (!member || member.role !== RoleEnum.ADMIN) {
      throw new ForbiddenException(
        'Solo los administradores pueden modificar el grupo.',
      );
    }

    return true;
  }
}
