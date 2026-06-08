import { Injectable } from '@nestjs/common';
import { Group } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateGroupDto } from '../dto/create-group.dto';
import { IGroupRepository } from './group.repository.interface';

@Injectable()
export class GroupPrismaRepository implements IGroupRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateGroupDto): Promise<Group> {
    return await this.prisma.group.create({
      data: {
        name: dto.name,
        shareLocationMandatorily: dto.shareLocationMandatorily ?? false,
      },
    });
  }
}
