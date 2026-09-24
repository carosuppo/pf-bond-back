import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MailModule } from '../mail/mail.module';
import { PrismaService } from '../prisma/prisma.service';
import { SessionAuthGuard } from './guard/session-auth.guard';
import { AccountDeletionPrismaRepository } from './repository/account-deletion.prisma.repository';
import { EmailVerificationTokenPrismaRepository } from './repository/email-verification-token.prisma.repository';
import { UserSessionPrismaRepository } from './repository/user-session.prisma.repository';
import { UserPrismaRepository } from './repository/user.prisma.repository';
import { AccountDeletionService } from './service/account-deletion.service';
import { SessionAuthenticationService } from './service/session-authentication.service';
import { SupabaseStorageService } from './storage/supabase-storage.service';
import { UserController } from './user.controller';
import { UserService } from './user.service';

@Module({
  imports: [ConfigModule, MailModule],
  controllers: [UserController],
  providers: [
    UserService,
    SupabaseStorageService,
    AccountDeletionService,
    PrismaService,
    SessionAuthGuard,
    SessionAuthenticationService,
    {
      provide: 'accountDeletionRepository',
      useClass: AccountDeletionPrismaRepository,
    },
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
  exports: [
    SessionAuthGuard,
    SessionAuthenticationService,
    SupabaseStorageService,
    'userSessionRepository',
  ],
})
export class UserModule {}
