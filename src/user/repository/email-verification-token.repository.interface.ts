import { EmailVerificationToken, User } from '@prisma/client';

export interface CreateEmailVerificationTokenData {
  userId: number;
  tokenHash: string;
  expiresAt: Date;
}

export type EmailVerificationTokenWithUser = EmailVerificationToken & {
  user: User;
};

export interface IEmailVerificationTokenRepository {
  create(
    createEmailVerificationTokenData: CreateEmailVerificationTokenData,
  ): Promise<EmailVerificationToken>;

  findByTokenHash(
    tokenHash: string,
  ): Promise<EmailVerificationTokenWithUser | null>;

  markAsUsed(tokenId: number): Promise<void>;

  invalidateActiveByUserId(userId: number): Promise<void>;
}
