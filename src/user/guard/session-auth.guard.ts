import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { createHash } from 'crypto';
import { UserMapper } from '../mapper/user.mapper';
import { AuthenticatedRequest } from '../interface/authenticated-request.interface';
import type { IUserSessionRepository } from '../repository/user-session.repository.interface';

@Injectable()
export class SessionAuthGuard implements CanActivate {
  constructor(
    @Inject('userSessionRepository')
    private readonly userSessionRepository: IUserSessionRepository,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    const sessionToken = this.extractBearerToken(request.headers.authorization);

    if (!sessionToken) {
      throw new UnauthorizedException('Sesión no válida.');
    }

    const tokenHash = createHash('sha256').update(sessionToken).digest('hex');

    const session =
      await this.userSessionRepository.findActiveByTokenHash(tokenHash);

    if (!session || session.user.deletedAt) {
      throw new UnauthorizedException('Sesión no válida.');
    }

    request.user = UserMapper.toResponseDto(session.user);
    request.sessionId = session.id;

    return true;
  }

  private extractBearerToken(
    authorizationHeader: string | undefined,
  ): string | null {
    if (!authorizationHeader) {
      return null;
    }

    const [type, token] = authorizationHeader.split(' ');

    if (type !== 'Bearer' || !token) {
      return null;
    }

    return token;
  }
}
