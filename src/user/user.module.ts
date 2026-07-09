import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { UserPrismaRepository } from './repository/user.prisma.repository';
import { UserSessionPrismaRepository } from './repository/user-session.prisma.repository';
import { SessionAuthGuard } from './guard/session-auth.guard';

@Module({
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
  ],
})
export class UserModule {}
