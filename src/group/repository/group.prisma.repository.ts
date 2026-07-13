import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { GroupEntity } from '../entity/group.entity';
import { CreateGroupData } from '../interface/create-group.interface';
import { IGroupRepository } from './group.repository.interface';

@Injectable()
export class GroupPrismaRepository implements IGroupRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: CreateGroupData): Promise<GroupEntity> {
    return await this.prisma.group.create({
      data: {
        name: data.name,
        description: data.description,
        shareLocationMandatorily: data.shareLocationMandatorily ?? false,
        invitationCode: data.invitationCode,
      },
    });
  }

  async findByInvitationCode(
    invitationCode: string,
  ): Promise<GroupEntity | null> {
    return await this.prisma.group.findUnique({
      where: { invitationCode },
    });
  }
}
