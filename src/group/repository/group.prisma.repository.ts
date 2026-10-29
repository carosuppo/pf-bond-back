import { Inject, Injectable } from '@nestjs/common';
import { Group, Prisma, RoleEnum } from '@prisma/client';
import type { IMemberRepository } from '../../member/repository/member.repository.interface';
import { PrismaService } from '../../prisma/prisma.service';
import { GetGroupEntity } from '../entity/get-group.entity';
import { CreateGroupData } from '../interface/create-group.interface';
import { UpdateGroupData } from '../interface/update-group.interface';
import { clearLocationIfUnshared } from '../../location/repository/clear-location-if-unshared';
import type {
  IGroupRepository,
  LeaveGroupResult,
} from './group.repository.interface';

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
          image: data.image,
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
        image: true,
        description: true,
        shareLocationMandatorily: true,
        invitationCode: true,
        members: {
          select: {
            id: true,
            role: true,
            user: {
              select: {
                id: true,
                name: true,
                profilePhoto: true,
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
      image: group.image,
      description: group.description,
      shareLocationMandatorily: group.shareLocationMandatorily,
      invitationCode: group.invitationCode,
      members: group.members.map((member) => ({
        id: member.id,
        idUser: member.user.id,
        name: member.user.name,
        profilePhoto: member.user.profilePhoto,
        role: member.role,
      })),
    };
  }

  async update(id: number, data: UpdateGroupData): Promise<Group> {
    return this.prisma.$transaction(async (tx) => {
      const group = await tx.group.update({ where: { id }, data });
      if (data.shareLocationMandatorily === false) {
        await tx.pointOfInterestPresence.deleteMany({
          where: { member: { groupId: id, locationSharingEnabled: false } },
        });
        const members = await tx.member.findMany({
          where: { groupId: id },
          select: { userId: true },
        });
        for (const member of members) {
          await clearLocationIfUnshared(tx, member.userId);
        }
      }
      return group;
    });
  }

  async updateImage(id: number, image: string): Promise<Group> {
    return this.prisma.group.update({
      where: { id },
      data: { image },
    });
  }

  async leave(id: number, userId: number): Promise<LeaveGroupResult> {
    return this.prisma.$transaction(
      async (tx) => {
        const group = await tx.group.findFirst({
          where: { id, deletedAt: null },
          select: { id: true },
        });

        if (!group) {
          return { status: 'notFound' };
        }

        const member = await tx.member.findUnique({
          where: { userId_groupId: { userId, groupId: id } },
          select: { id: true },
        });

        if (!member) {
          return { status: 'notMember' };
        }

        const memberCount = await tx.member.count({ where: { groupId: id } });

        if (memberCount === 1) {
          const deleted = await this.softDeleteInTransaction(id, tx);

          return deleted
            ? { status: 'deleted', memberId: member.id }
            : { status: 'notFound' };
        }

        await this.memberRepository.deleteMember(member.id, tx);
        await clearLocationIfUnshared(tx, userId);

        return { status: 'left', memberId: member.id };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  async softDelete(id: number): Promise<boolean> {
    return this.prisma.$transaction((tx) =>
      this.softDeleteInTransaction(id, tx),
    );
  }

  private async softDeleteInTransaction(
    id: number,
    tx: Prisma.TransactionClient,
  ): Promise<boolean> {
    const members = await tx.member.findMany({
      where: { groupId: id },
      select: { userId: true },
    });
    const result = await tx.group.updateMany({
      where: { id, deletedAt: null },
      data: { deletedAt: new Date() },
    });

    if (result.count === 0) {
      return false;
    }

    await tx.member.deleteMany({ where: { groupId: id } });
    for (const member of members) {
      await clearLocationIfUnshared(tx, member.userId);
    }
    return true;
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
