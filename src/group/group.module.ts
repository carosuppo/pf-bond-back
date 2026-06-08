import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GroupController } from './group.controller';
import { GroupService } from './group.service';
import { GroupPrismaRepository } from './repository/group.prisma.repository';
@Module({
  controllers: [GroupController],
  providers: [
    GroupService,
    PrismaService,
    {
      provide: 'groupRepository',
      useClass: GroupPrismaRepository,
    },
  ],
})
export class GroupModule {}
