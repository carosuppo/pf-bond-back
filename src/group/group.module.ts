import { Module } from '@nestjs/common';
import { MemberModule } from '../member/member.module';
import { PrismaService } from '../prisma/prisma.service';
import { UserModule } from '../user/user.module';
import { GroupController } from './group.controller';
import { GroupEventService } from './group-event.service';
import { GroupService } from './group.service';
import { InvitationCodeHelper } from './helper/invitation-code.helper';
import { GroupPrismaRepository } from './repository/group.prisma.repository';
import { InvitationCodeValidator } from './validator/invitation-code.validator';

@Module({
  imports: [MemberModule, UserModule],
  controllers: [GroupController],
  providers: [
    GroupService,
    GroupEventService,
    PrismaService,
    InvitationCodeHelper,
    InvitationCodeValidator,
    {
      provide: 'groupRepository',
      useClass: GroupPrismaRepository,
    },
  ],
  exports: ['groupRepository', GroupEventService],
})
export class GroupModule {}
