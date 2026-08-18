import { Inject, Injectable } from '@nestjs/common';
import { Group, RoleEnum } from '@prisma/client';
import type { IMemberRepository } from '../../member/repository/member.repository.interface';
import { PrismaService } from '../../prisma/prisma.service';
import { GetGroupEntity } from '../entity/get-group.entity';
import { CreateGroupData } from '../interface/create-group.interface';
import { UpdateGroupData } from '../interface/update-group.interface';
import { IGroupRepository } from './group.repository.interface';

@Injectable()
export class GroupPrismaRepository implements IGroupRepository {
  constructor(
    private readonly prisma: PrismaService,
    @Inject('memberRepository')
    private readonly memberRepository: IMemberRepository,
  ) {}

  async create(data: CreateGroupData, userId: number): Promise<Group> {
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
    return this.prisma.group.findFirst({
      where: { invitationCode },
    });
  }

  async findById(id: number): Promise<Group | null> {
    return this.prisma.group.findFirst({
      where: { id, deletedAt: null },
    });
  }

  async findGroupWithMembers(id: number): Promise<GetGroupEntity | null> {
    const group = await this.prisma.group.findFirst({
      where: {
        id,
        deletedAt: null,
      },
      select: {
        id: true,
        name: true,
        description: true,
        shareLocationMandatorily: true,
        invitationCode: true,
        members: {
          select: {
            role: true,
            user: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    if (!group) {
      return null;
    }

    return {
      id: group.id,
      name: group.name,
      description: group.description,
      shareLocationMandatorily: group.shareLocationMandatorily,
      invitationCode: group.invitationCode,
      members: group.members.map((member) => ({
        idUser: member.user.id,
        name: member.user.name,
        role: member.role,
      })),
    };
  }

  async update(id: number, data: UpdateGroupData): Promise<Group> {
    return this.prisma.group.update({
      where: { id },
      data,
    });
  }

  async findByUserId(userId: number): Promise<Group[]> {
    return this.prisma.group.findMany({
      where: {
        deletedAt: null,
        members: {
          some: {
            userId,
          },
        },
      },
      orderBy: {
        name: 'asc',
      },
    });
  }
}
