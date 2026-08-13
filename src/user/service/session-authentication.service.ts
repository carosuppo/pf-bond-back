import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { createHash } from 'crypto';
import { UserResponseDto } from '../dto/user-response.dto';
import { UserMapper } from '../mapper/user.mapper';
import type { IUserSessionRepository } from '../repository/user-session.repository.interface';

export interface SessionAuthenticationResult {
  sessionId: number;
  user: UserResponseDto;
}

@Injectable()
export class SessionAuthenticationService {
  constructor(
    @Inject('userSessionRepository')
    private readonly userSessionRepository: IUserSessionRepository,
  ) {}

  async authenticate(
    sessionToken: string | null | undefined,
  ): Promise<SessionAuthenticationResult> {
    if (!sessionToken) throw new UnauthorizedException('Invalid session.');
    const tokenHash = createHash('sha256').update(sessionToken).digest('hex');
    const session =
      await this.userSessionRepository.findActiveByTokenHash(tokenHash);
    if (!session || session.user.deletedAt) {
      throw new UnauthorizedException('Invalid session.');
    }
    return {
      sessionId: session.id,
      user: UserMapper.toResponseDto(session.user),
    };
  }
}
