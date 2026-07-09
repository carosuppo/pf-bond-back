import { User, UserSession } from '@prisma/client';
import { CreateUserSessionData } from '../interface/create-user-session.interface';

export type UserSessionWithUser = UserSession & {
  user: User;
};

export interface IUserSessionRepository {
  create(createUserSessionData: CreateUserSessionData): Promise<UserSession>;
  findActiveByTokenHash(tokenHash: string): Promise<UserSessionWithUser | null>;
  revokeById(sessionId: number): Promise<void>;
}
