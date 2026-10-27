import { Injectable } from '@nestjs/common';
import { EmailVerificationToken } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreateEmailVerificationTokenData,
  EmailVerificationTokenWithUser,
  IEmailVerificationTokenRepository,
} from './email-verification-token.repository.interface';

@Injectable()
export class EmailVerificationTokenPrismaRepository implements IEmailVerificationTokenRepository {
  constructor(private readonly prismaService: PrismaService) {}

  async create(
    createEmailVerificationTokenData: CreateEmailVerificationTokenData,
  ): Promise<EmailVerificationToken> {
    return this.prismaService.emailVerificationToken.create({
      data: {
        userId: createEmailVerificationTokenData.userId,
        tokenHash: createEmailVerificationTokenData.tokenHash,
        expiresAt: createEmailVerificationTokenData.expiresAt,
      },
    });
  }

  async findByTokenHash(
    tokenHash: string,
  ): Promise<EmailVerificationTokenWithUser | null> {
    return this.prismaService.emailVerificationToken.findFirst({
      where: {
        tokenHash,
      },
      include: {
        user: true,
      },
    });
  }

  async markAsUsed(tokenId: number): Promise<boolean> {
    const result = await this.prismaService.emailVerificationToken.updateMany({
      where: {
        id: tokenId,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
      data: {
        usedAt: new Date(),
      },
    });
    return result.count === 1;
  }

  async invalidateActiveByUserId(userId: number): Promise<void> {
    await this.prismaService.emailVerificationToken.updateMany({
      where: {
        userId,
        usedAt: null,
      },
      data: {
        usedAt: new Date(),
      },
    });
  }
}
