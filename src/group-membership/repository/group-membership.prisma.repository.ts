import { Injectable } from '@nestjs/common';
import { Member, Prisma, PrismaClient } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AddMemberData } from '../interface/add-member.interface';
import { IGroupMembershipRepository } from './group-membership.repository.interface';

@Injectable()
export class GroupMembershipPrismaRepository implements IGroupMembershipRepository {
  constructor(private readonly prismaService: PrismaService) {}

  async addMember(
    addMemberData: AddMemberData,
    prisma: Prisma.TransactionClient | PrismaClient = this.prismaService,
  ): Promise<Member> {
    return prisma.member.create({
      data: {
        groupId: addMemberData.groupId,
        userId: addMemberData.userId,
        role: addMemberData.role,
      },
    });
  }
}
