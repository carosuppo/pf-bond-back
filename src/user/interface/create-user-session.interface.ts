export interface CreateUserSessionData {
  userId: number;
  tokenHash: string;
  expiresAt: Date;
}
