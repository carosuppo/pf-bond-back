import {
  Inject,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { createHash } from 'crypto';
import { logErrorSafely } from '../../common/logging/error-logging';
import { AGE_VERIFICATION_REQUIRED_MESSAGE } from '../constants/minimum-account-age';
import {
  TERMS_ACCEPTANCE_REQUIRED_MESSAGE,
  TERMS_OF_USE_VERSION,
} from '../constants/terms-of-use.constants';
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

    if (!session.user.ageVerifiedAt) {
      await this.userSessionRepository.revokeById(session.id);
      throw new UnauthorizedException(AGE_VERIFICATION_REQUIRED_MESSAGE);
    }
    if (
      !session.user.termsAcceptedAt ||
      session.user.termsAcceptedVersion !== TERMS_OF_USE_VERSION
    ) {
      await this.userSessionRepository.revokeById(session.id);
      throw new UnauthorizedException(TERMS_ACCEPTANCE_REQUIRED_MESSAGE);
    }

    return {
      sessionId: session.id,
      user: UserMapper.toResponseDto(session.user),
    };
  }
}
