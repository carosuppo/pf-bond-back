import { ExecutionContext, InternalServerErrorException } from '@nestjs/common';
import { SessionAuthenticationService } from '../service/session-authentication.service';
import { SessionAuthGuard } from './session-auth.guard';

describe('SessionAuthGuard', () => {
  it('returns a generic server error when session storage fails', async () => {
    const service = {
      authenticate: jest
        .fn()
        .mockRejectedValue(
          new Error('database connection contains credentials'),
        ),
    } as unknown as SessionAuthenticationService;
    const guard = new SessionAuthGuard(service);
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({ headers: { authorization: 'Bearer secret' } }),
      }),
    } as unknown as ExecutionContext;

    await expect(guard.canActivate(context)).rejects.toMatchObject(
      new InternalServerErrorException('Internal server error'),
    );
  });
});
