import { Module } from '@nestjs/common';
import { NotificationModule } from '../notification/notification.module';
import { MemberModule } from '../member/member.module';
import { UserModule } from '../user/user.module';
import { GroupEventService } from './group-event.service';
import { GroupController } from './group.controller';
import { GroupService } from './group.service';
import { InvitationCodeHelper } from './helper/invitation-code.helper';
import { InvitationLinkController } from './invitation-link.controller';
import { NormalizeInvitationCodeParamPipe } from './pipe/normalize-invitation-code-param.pipe';
import { GroupPrismaRepository } from './repository/group.prisma.repository';
import { GroupJoinRequestPrismaRepository } from './repository/group-join-request.prisma.repository';
import { InvitationCodeValidator } from './validator/invitation-code.validator';

@Module({
  imports: [MemberModule, UserModule, NotificationModule],
  controllers: [GroupController, InvitationLinkController],
  providers: [
    GroupService,
    GroupEventService,
    InvitationCodeHelper,
    InvitationCodeValidator,
    NormalizeInvitationCodeParamPipe,
    {
      provide: 'groupRepository',
      useClass: GroupPrismaRepository,
    },
    {
      provide: 'groupJoinRequestRepository',
      useClass: GroupJoinRequestPrismaRepository,
    },
  ],
  exports: ['groupRepository', GroupEventService],
})
export class GroupModule {}
