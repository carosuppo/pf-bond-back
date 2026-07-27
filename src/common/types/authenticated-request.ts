import { Request } from 'express';
import { Role } from '../enums/role.enum';

export interface AuthUser {
  id: string;
  email: string;
  role: Role;
}

export interface AuthenticatedRequest extends Request {
  user: AuthUser;
}
