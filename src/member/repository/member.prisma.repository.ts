import { Injectable } from '@nestjs/common';
import { Member, Prisma, PrismaClient, RoleEnum } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { GetMemberInfoEntity } from '../entity/get-member-info.entity';
import { AddMemberData } from '../interface/add-member.interface';
import { IMemberRepository } from './member.repository.interface';

@Injectable()
export class MemberPrismaRepository implements IMemberRepository {
  constructor(private readonly prismaService: PrismaService) {}

  async addMember(
    addMemberData: AddMemberData,
    tx: Prisma.TransactionClient | PrismaClient = this.prismaService,
  ): Promise<Member> {
    return tx.member.create({
      data: {
        groupId: addMemberData.groupId,
        userId: addMemberData.userId,
        role: addMemberData.role,
      },
    });
  }

  async findByUserAndGroup(
    userId: number,
    groupId: number,
  ): Promise<Member | null> {
    return this.prismaService.member.findFirst({
      where: {
        userId,
        groupId,
      },
    });
  }

  async findByIdWithUser(
    memberId: number,
  ): Promise<GetMemberInfoEntity | null> {
    const member = await this.prismaService.member.findUnique({
      where: {
        id: memberId,
      },
      select: {
        id: true,
        groupId: true,
        user: {
          select: {
            name: true,
            profilePhoto: true,
            currentLocation: {
              select: {
                lastSeenAt: true,
              },
            },
          },
        },
      },
    });

    if (!member) {
      return null;
    }

    return {
      memberId: member.id,
      groupId: member.groupId,
      name: member.user.name,
      profilePhoto: member.user.profilePhoto,
      lastSeenAt: member.user.currentLocation?.lastSeenAt ?? null,
    };
  }

  async findById(memberId: number): Promise<Member | null> {
    return this.prismaService.member.findUnique({
      where: {
        id: memberId,
      },
    });
  }

  async countAdminsByGroup(groupId: number): Promise<number> {
    return this.prismaService.member.count({
      where: {
        groupId,
        role: RoleEnum.ADMIN,
      },
    });
  }

  async updateRole(memberId: number, role: RoleEnum): Promise<Member> {
    return this.prismaService.member.update({
      where: {
        id: memberId,
      },
      data: {
        role,
      },
    });
  }

  async deleteMember(
    memberId: number,
    transaction?: Prisma.TransactionClient,
  ): Promise<Member> {
    const remove = async (tx: Prisma.TransactionClient): Promise<Member> => {
      const member = await tx.member.findUniqueOrThrow({
        where: { id: memberId },
        select: { id: true, groupId: true, role: true },
      });

      if (member.role === RoleEnum.ADMIN) {
        const anotherAdmin = await tx.member.findFirst({
          where: {
            groupId: member.groupId,
            id: { not: memberId },
            role: RoleEnum.ADMIN,
          },
          select: { id: true },
        });

        if (!anotherAdmin) {
          const successor = await tx.member.findFirst({
            where: {
              groupId: member.groupId,
              id: { not: memberId },
            },
            orderBy: { id: 'asc' },
            select: { id: true },
          });

          if (successor) {
            await tx.member.update({
              where: { id: successor.id },
              data: { role: RoleEnum.ADMIN },
            });
          }
        }
      }

      return tx.member.delete({
        where: { id: memberId },
      });
    };

    return transaction
      ? remove(transaction)
      : this.prismaService.$transaction(remove);
  }

  async getMembersByIds(
    memberIds: number[],
    groupId: number,
  ): Promise<number[]> {
    const members = await this.prismaService.member.findMany({
      where: {
        id: {
          in: memberIds,
        },
        groupId,
      },
      select: {
        id: true,
      },
    });

    return members.map((member) => member.id);
  }
}
