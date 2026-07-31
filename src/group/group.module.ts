import { Module } from '@nestjs/common';
import { MemberModule } from '../member/member.module';
import { PrismaService } from '../prisma/prisma.service';
import { UserModule } from '../user/user.module';
import { GroupController } from './group.controller';
import { GroupService } from './group.service';
import { InvitationCodeHelper } from './helper/invitation-code.helper';
import { GroupPrismaRepository } from './repository/group.prisma.repository';
import { InvitationCodeValidator } from './validator/invitation-code.validator';

@Module({
  imports: [MemberModule, UserModule],
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
