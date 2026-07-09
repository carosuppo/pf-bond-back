import { CreateUserSessionData } from '../interface/create-user-session.interface';
export interface SessionTokenData {
  sessionToken: string;
  expiresAt: Date;
}

export class UserSessionMapper {
  static toCreateUserSessionData(
    userId: number,
    tokenHash: string,
    expiresAt: Date,
  ): CreateUserSessionData {
    return {
      userId,
      tokenHash,
      expiresAt,
    };
  }

  static toSessionTokenData(
    sessionToken: string,
    expiresAt: Date,
  ): SessionTokenData {
    return {
      sessionToken,
      expiresAt,
    };
  }
}
