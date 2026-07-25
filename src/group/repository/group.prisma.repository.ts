import { Injectable } from '@nestjs/common';
import { Group, RoleEnum } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateGroupData } from '../interface/create-group.interface';
import { IGroupRepository } from './group.repository.interface';

@Injectable()
export class GroupPrismaRepository implements IGroupRepository {
  constructor(private readonly prisma: PrismaService) {}

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

      await tx.member.create({
        data: {
          groupId: group.id,
          userId,
          role: RoleEnum.ADMIN,
        },
      });

      return group;
    });
  }

  async findByInvitationCode(invitationCode: string): Promise<Group | null> {
    return this.prisma.group.findUnique({
      where: { invitationCode },
    });
  }
}
