export interface CreateUserData {
  name: string;
  email: string;
  passwordHash: string;
  ageVerifiedAt: Date;
  termsAcceptedAt: Date;
  termsAcceptedVersion: string;
}
