import {
  Inject,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { createHash } from 'crypto';
import { logErrorSafely } from '../../common/logging/error-logging';
import { UserResponseDto } from '../dto/user-response.dto';
import { UserMapper } from '../mapper/user.mapper';
import type {
  IUserSessionRepository,
  UserSessionWithUser,
} from '../repository/user-session.repository.interface';

export interface SessionAuthenticationResult {
  sessionId: number;
  user: UserResponseDto;
}

@Injectable()
export class SessionAuthenticationService {
  private readonly logger = new Logger(SessionAuthenticationService.name);

  constructor(
    @Inject('userSessionRepository')
    private readonly userSessionRepository: IUserSessionRepository,
  ) {}

  async authenticate(
    sessionToken: string | null | undefined,
  ): Promise<SessionAuthenticationResult> {
    if (!sessionToken) throw new UnauthorizedException('Invalid session.');
    const tokenHash = createHash('sha256').update(sessionToken).digest('hex');
    let session: UserSessionWithUser | null;

    try {
      session =
        await this.userSessionRepository.findActiveByTokenHash(tokenHash);
    } catch (error: unknown) {
      logErrorSafely(
        this.logger,
        'operation=findActiveSession outcome=error',
        error,
      );
      throw error;
    }

    if (!session) {
      throw new UnauthorizedException('Invalid session.');
    }
    return {
      sessionId: session.id,
      user: UserMapper.toResponseDto(session.user),
    };
  }
}
