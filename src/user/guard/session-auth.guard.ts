import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { AuthenticatedRequest } from '../interface/authenticated-request.interface';
import { SessionAuthenticationService } from '../service/session-authentication.service';

@Injectable()
export class SessionAuthGuard implements CanActivate {
  constructor(
    private readonly sessionAuthenticationService: SessionAuthenticationService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const authentication = await this.sessionAuthenticationService.authenticate(
      this.extractBearerToken(request.headers.authorization),
    );

    request.user = authentication.user;
    request.sessionId = authentication.sessionId;
    return true;
  }

  private extractBearerToken(
    authorizationHeader: string | undefined,
  ): string | null {
    if (!authorizationHeader) return null;
    const [type, token] = authorizationHeader.split(' ');
    return type === 'Bearer' && token ? token : null;
  }
}
