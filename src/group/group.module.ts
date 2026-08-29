import { Module } from '@nestjs/common';
import { MemberModule } from '../member/member.module';
import { PrismaService } from '../prisma/prisma.service';
import { UserModule } from '../user/user.module';
import { GroupController } from './group.controller';
import { GroupService } from './group.service';
import { InvitationCodeHelper } from './helper/invitation-code.helper';
import { GroupPrismaRepository } from './repository/group.prisma.repository';

@Module({
  imports: [MemberModule, UserModule],
  controllers: [GroupController],
  providers: [
    GroupService,
    PrismaService,
    InvitationCodeHelper,
    {
      provide: 'groupRepository',
      useClass: GroupPrismaRepository,
    },
  ],
  exports: ['groupRepository'],
})
export class GroupModule {}
