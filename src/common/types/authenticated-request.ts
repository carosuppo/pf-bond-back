import { RoleEnum } from '@prisma/client';
import { Request } from 'express';

export interface AuthUser {
  id: string;
  email: string;
  role: RoleEnum;
}

export interface AuthenticatedRequest extends Request {
  user: AuthUser;
}
