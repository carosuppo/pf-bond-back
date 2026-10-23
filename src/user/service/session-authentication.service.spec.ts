import { Logger, UnauthorizedException } from '@nestjs/common';
import type { IUserSessionRepository } from '../repository/user-session.repository.interface';
import { SessionAuthenticationService } from './session-authentication.service';

describe('SessionAuthenticationService', () => {
  afterEach(() => jest.restoreAllMocks());

  it('logs session lookup failures without exposing the session token', async () => {
    const logger = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
    const error = Object.assign(new Error('private session token'), {
      code: 'P2024',
    });
    const repository = {
      findActiveByTokenHash: jest.fn().mockRejectedValue(error),
    } as unknown as IUserSessionRepository;
    const service = new SessionAuthenticationService(repository);

    await expect(service.authenticate('private-session-token')).rejects.toBe(
      error,
    );

    expect(logger).toHaveBeenCalledWith(
      'operation=findActiveSession outcome=error errorType=Error errorCode=P2024',
    );
    const logged = JSON.stringify(logger.mock.calls);
    expect(logged).not.toContain('private-session-token');
    expect(logged).not.toContain('private session token');
  });

  it('preserves unauthorized behavior for a missing session', async () => {
    const logger = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
    const findActiveByTokenHash = jest.fn();
    const repository = {
      findActiveByTokenHash,
    } as unknown as IUserSessionRepository;
    const service = new SessionAuthenticationService(repository);

    await expect(service.authenticate(null)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(findActiveByTokenHash).not.toHaveBeenCalled();
    expect(logger).not.toHaveBeenCalled();
  });
});
