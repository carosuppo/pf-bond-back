import { Inject, Injectable } from '@nestjs/common';
import { Prisma, RoleEnum } from '@prisma/client';
import { AddMemberDto } from './dto/add-member.dto';
import { GroupMembershipMapper } from './mapper/group-membership.mapper';
import type { IGroupMembershipRepository } from './repository/group-membership.repository.interface';

@Injectable()
export class GroupMembershipService {
  constructor(
    @Inject('groupMembershipRepository')
    private readonly groupMembershipRepository: IGroupMembershipRepository,
  ) {}
  async addMember(
    addMemberDto: AddMemberDto,
    role: RoleEnum,
    prisma?: Prisma.TransactionClient,
  ): Promise<void> {
    const addMemberData = GroupMembershipMapper.toAddMemberData(
      addMemberDto,
      role,
    );
    await this.groupMembershipRepository.addMember(addMemberData, prisma);
  }
}
