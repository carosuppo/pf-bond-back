import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GroupController } from './group.controller';
import { GroupService } from './group.service';
import { InvitationCodeHelper } from './helper/invitation-code.helper';
import { GroupPrismaRepository } from './repository/group.prisma.repository';
import { InvitationCodeValidator } from './validator/invitation-code.validator';

@Module({
  controllers: [GroupController],
  providers: [
    GroupService,
    PrismaService,
    InvitationCodeHelper,
    InvitationCodeValidator,
    {
      provide: 'groupRepository',
      useClass: GroupPrismaRepository,
    },
  ],
})
export class GroupModule {}
