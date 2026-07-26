import { Inject, Injectable } from '@nestjs/common';
import { Group, RoleEnum } from '@prisma/client';
import type { IMemberRepository } from '../../member/repository/member.repository.interface';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateGroupData } from '../interface/create-group.interface';
import { IGroupRepository } from './group.repository.interface';

@Injectable()
export class GroupPrismaRepository implements IGroupRepository {
  constructor(
    private readonly prisma: PrismaService,
    @Inject('memberRepository')
    private readonly memberRepository: IMemberRepository,
  ) {}

  async createGroup(data: CreateGroupData, userId: number): Promise<Group> {
    return this.prisma.$transaction(async (tx) => {
      const group = await tx.group.create({
        data: {
          name: data.name,
          description: data.description,
          shareLocationMandatorily: data.shareLocationMandatorily,
          invitationCode: data.invitationCode,
        },
      });

      await this.memberRepository.addMember(
        {
          groupId: group.id,
          userId,
          role: RoleEnum.ADMIN,
        },
        tx,
      );

      return group;
    });
  }

  async findByInvitationCode(invitationCode: string): Promise<Group | null> {
    return this.prisma.group.findUnique({
      where: { invitationCode },
    });
  }
}
