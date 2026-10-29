import { Logger, UnauthorizedException } from '@nestjs/common';
import { AGE_VERIFICATION_REQUIRED_MESSAGE } from '../constants/minimum-account-age';
import { TERMS_ACCEPTANCE_REQUIRED_MESSAGE } from '../constants/terms-of-use.constants';
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

  it('revokes sessions for accounts without age verification', async () => {
    const revokeById = jest.fn().mockResolvedValue(undefined);
    const repository = {
      findActiveByTokenHash: jest.fn().mockResolvedValue({
        id: 17,
        user: {
          ageVerifiedAt: null,
          termsAcceptedAt: null,
          termsAcceptedVersion: null,
        },
      }),
      revokeById,
    } as unknown as IUserSessionRepository;
    const service = new SessionAuthenticationService(repository);

    await expect(service.authenticate('unverified-session')).rejects.toThrow(
      AGE_VERIFICATION_REQUIRED_MESSAGE,
    );
    expect(revokeById).toHaveBeenCalledWith(17);
  });

  it('revokes sessions for accounts that have not accepted the current terms', async () => {
    const revokeById = jest.fn().mockResolvedValue(undefined);
    const repository = {
      findActiveByTokenHash: jest.fn().mockResolvedValue({
        id: 21,
        user: {
          ageVerifiedAt: new Date(),
          termsAcceptedAt: null,
          termsAcceptedVersion: null,
        },
      }),
      revokeById,
    } as unknown as IUserSessionRepository;
    const service = new SessionAuthenticationService(repository);

    await expect(
      service.authenticate('terms-unaccepted-session'),
    ).rejects.toThrow(TERMS_ACCEPTANCE_REQUIRED_MESSAGE);
    expect(revokeById).toHaveBeenCalledWith(21);
  });
});
