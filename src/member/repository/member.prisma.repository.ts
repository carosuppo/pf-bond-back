import { Injectable } from '@nestjs/common';
import { Member, Prisma, PrismaClient } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
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
}
