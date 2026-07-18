import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GroupMembershipController } from './group-membership.controller';
import { GroupMembershipService } from './group-membership.service';
import { GroupMembershipPrismaRepository } from './repository/group-membership.prisma.repository';

@Module({
  controllers: [GroupMembershipController],
  providers: [
    GroupMembershipService,
    PrismaService,
    {
      provide: 'groupMembershipRepository',
      useClass: GroupMembershipPrismaRepository,
    },
  ],
})
export class GroupMembershipModule {}
