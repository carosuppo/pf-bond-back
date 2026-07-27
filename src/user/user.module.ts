import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MailModule } from '../mail/mail.module';
import { PrismaService } from '../prisma/prisma.service';
import { SessionAuthGuard } from './guard/session-auth.guard';
import { EmailVerificationTokenPrismaRepository } from './repository/email-verification-token.prisma.repository';
import { UserPrismaRepository } from './repository/user.prisma.repository';
import { UserSessionPrismaRepository } from './repository/user-session.prisma.repository';
import { UserController } from './user.controller';
import { UserService } from './user.service';

@Module({
  imports: [ConfigModule, MailModule],
  controllers: [UserController],
  providers: [
    UserService,
    PrismaService,
    SessionAuthGuard,
    {
      provide: 'userRepository',
      useClass: UserPrismaRepository,
    },
    {
      provide: 'userSessionRepository',
      useClass: UserSessionPrismaRepository,
    },
    {
      provide: 'emailVerificationTokenRepository',
      useClass: EmailVerificationTokenPrismaRepository,
    },
  ],
})
export class UserModule {}
