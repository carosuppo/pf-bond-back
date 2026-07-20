import { Inject, Injectable } from '@nestjs/common';
import { Group, RoleEnum } from '@prisma/client';
import { IGroupMembershipRepository } from '../../group-membership/repository/group-membership.repository.interface';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateGroupData } from '../interface/create-group.interface';
import { IGroupRepository } from './group.repository.interface';

@Injectable()
export class GroupPrismaRepository implements IGroupRepository {
  constructor(
    private readonly prisma: PrismaService,
    @Inject('groupMembershipRepository')
    private readonly groupMembershipRepository: IGroupMembershipRepository,
  ) {}

  async createGroup(data: CreateGroupData, userId: number): Promise<Group> {
    try {
      return this.prisma.$transaction(async (tx) => {
        const group = await tx.group.create({
          data: {
            name: data.name,
            description: data.description,
            shareLocationMandatorily: data.shareLocationMandatorily,
            invitationCode: data.invitationCode,
          },
        });

        await this.groupMembershipRepository.create({
          data: {
            groupId: group.id,
            userId: userId,
            role: RoleEnum.ADMIN,
          },
          tx,
        });

        return group;
      });
    } catch (error) {
      throw new Error(`Error al crear el grupo: ${String(error)}`);
    }
  }

  async findByInvitationCode(invitationCode: string): Promise<Group | null> {
    return this.prisma.group.findUnique({
      where: { invitationCode },
    });
  }
}
