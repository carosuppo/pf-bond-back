import { Module } from '@nestjs/common';
import { UserModule } from '../user/user.module';
import { MemberController } from './member.controller';
import { MemberService } from './member.service';
import { MemberPrismaRepository } from './repository/member.prisma.repository';

@Module({
  imports: [UserModule],
  controllers: [MemberController],
  providers: [
    MemberService,
    {
      provide: 'memberRepository',
      useClass: MemberPrismaRepository,
    },
  ],
  exports: ['memberRepository'],
})
export class MemberModule {}
