import { Request } from 'express';
import { UserResponseDto } from '../dto/user-response.dto';

export interface AuthenticatedRequest extends Request {
  user?: UserResponseDto;
  sessionId?: number;
}
