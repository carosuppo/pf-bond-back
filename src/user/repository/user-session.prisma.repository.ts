import { Injectable } from '@nestjs/common';
import { UserSession } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  IUserSessionRepository,
  UserSessionWithUser,
} from './user-session.repository.interface';
import { CreateUserSessionData } from '../interface/create-user-session.interface';

@Injectable()
export class UserSessionPrismaRepository implements IUserSessionRepository {
  constructor(private readonly prismaService: PrismaService) {}

  async create(
    createUserSessionData: CreateUserSessionData,
  ): Promise<UserSession> {
    return this.prismaService.userSession.create({
      data: {
        userId: createUserSessionData.userId,
        tokenHash: createUserSessionData.tokenHash,
        expiresAt: createUserSessionData.expiresAt,
      },
    });
  }

  async findActiveByTokenHash(
    tokenHash: string,
  ): Promise<UserSessionWithUser | null> {
    return this.prismaService.userSession.findFirst({
      where: {
        tokenHash,
        revokedAt: null,
        expiresAt: {
          gt: new Date(),
        },
      },
      include: {
        user: true,
      },
    });
  }

  async revokeById(sessionId: number): Promise<void> {
    await this.prismaService.userSession.update({
      where: {
        id: sessionId,
      },
      data: {
        revokedAt: new Date(),
      },
    });
  }
}
