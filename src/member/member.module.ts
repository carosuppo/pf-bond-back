import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MailModule } from '../mail/mail.module';
import { UserModule } from '../user/user.module';
import { MemberController } from './member.controller';
import { MemberReportService } from './service/member-report.service';
import { MemberService } from './member.service';
import { MemberPrismaRepository } from './repository/member.prisma.repository';
import { UserBlockPrismaRepository } from './repository/user-block.prisma.repository';
import { UserBlockService } from './service/user-block.service';

@Module({
  imports: [ConfigModule, MailModule, UserModule],
  controllers: [MemberController],
  providers: [
    MemberService,
    MemberReportService,
    UserBlockService,
    {
      provide: 'memberRepository',
      useClass: MemberPrismaRepository,
    },
    {
      provide: 'userBlockRepository',
      useClass: UserBlockPrismaRepository,
    },
  ],
  exports: ['memberRepository', 'userBlockRepository'],
})
export class MemberModule {}
