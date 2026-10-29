import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import { MailService } from '../../mail/mail.service';
import type { IAccountDeletionRepository } from '../repository/account-deletion.repository.interface';
import type { IUserRepository } from '../repository/user.repository.interface';
import { AccountDeletionService } from './account-deletion.service';
import { AccountDeletionRequestService } from './account-deletion-request.service';

describe('AccountDeletionRequestService', () => {
  const user = {
    id: 7,
    email: 'person@example.com',
    name: 'Persona',
  };

  function createService(options?: {
    user?: typeof user | null;
    created?: boolean;
    consumeUserId?: number | null;
  }) {
    const createDeletionRequest = jest
      .fn<Promise<boolean>, [number, string, Date, Date, Date]>()
      .mockResolvedValue(options?.created ?? true);
    const repository = {
      createDeletionRequest,
      cancelDeletionRequest: jest.fn().mockResolvedValue(undefined),
      consumeDeletionRequest: jest
        .fn()
        .mockResolvedValue(options?.consumeUserId ?? null),
      findExpiredUnverifiedUserIds: jest.fn().mockResolvedValue([]),
      deleteExpiredDeletionRequests: jest.fn().mockResolvedValue(undefined),
    };
    const userRepository = {
      findByEmail: jest
        .fn()
        .mockResolvedValue(options && 'user' in options ? options.user : user),
    };
    const mailService = { sendAccountDeletionConfirmation: jest.fn() };
    const configService = {
      get: jest.fn((key: string) => {
        const values: Record<string, string> = {
          API_BASE_URL: 'https://bond.example.com',
          LEGAL_BASE_URL: 'https://bond.example.com/legal/',
        };
        return values[key];
      }),
    };
    const accountDeletionService = { deleteAccount: jest.fn() };
    const service = new AccountDeletionRequestService(
      repository as unknown as IAccountDeletionRepository,
      userRepository as unknown as IUserRepository,
      mailService as unknown as MailService,
      configService as unknown as ConfigService,
      accountDeletionService as unknown as AccountDeletionService,
    );

    return {
      service,
      repository,
      createDeletionRequest,
      userRepository,
      mailService,
      configService,
      accountDeletionService,
    };
  }

  it('sends a confirmation link with a hashed single-use token', async () => {
    const fixture = createService();

    await fixture.service.request(' PERSON@example.com ');

    expect(fixture.userRepository.findByEmail).toHaveBeenCalledWith(
      'person@example.com',
    );
    expect(fixture.repository.createDeletionRequest).toHaveBeenCalledWith(
      user.id,
      expect.stringMatching(/^[a-f0-9]{64}$/),
      expect.any(Date),
      expect.any(Date),
      expect.any(Date),
    );
    const mail = fixture.mailService.sendAccountDeletionConfirmation.mock
      .calls[0] as [string, string, string];
    const confirmationUrl = new URL(mail[2]);
    const token = confirmationUrl.hash.slice(1);
    const tokenHash = createHash('sha256').update(token).digest('hex');
    expect(confirmationUrl.pathname).toBe('/legal/account-deletion/confirm/');
    expect(token).toHaveLength(43);
    expect(fixture.createDeletionRequest.mock.calls[0][1]).toBe(tokenHash);
    expect(mail.slice(0, 2)).toEqual([user.email, user.name]);
  });

  it('does not reveal whether an email has an account', async () => {
    const fixture = createService({ user: null });

    await expect(
      fixture.service.request('missing@example.com'),
    ).resolves.toBeUndefined();
    expect(
      fixture.mailService.sendAccountDeletionConfirmation,
    ).not.toHaveBeenCalled();
  });

  it('confirms a valid token and deletes the account', async () => {
    const fixture = createService({ consumeUserId: user.id });
    const token = 'deletion-token';

    await fixture.service.confirm(token);

    expect(fixture.repository.consumeDeletionRequest).toHaveBeenCalledWith(
      createHash('sha256').update(token).digest('hex'),
      expect.any(Date),
    );
    expect(fixture.accountDeletionService.deleteAccount).toHaveBeenCalledWith(
      user.id,
    );
  });

  it('rejects an invalid or expired token without deleting an account', async () => {
    const fixture = createService();

    await expect(fixture.service.confirm('expired')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(fixture.accountDeletionService.deleteAccount).not.toHaveBeenCalled();
  });

  it('purges unverified accounts and expired requests', async () => {
    const fixture = createService();
    fixture.repository.findExpiredUnverifiedUserIds.mockResolvedValue([4, 5]);

    await fixture.service.purgeExpiredUnverifiedAccounts();

    expect(fixture.accountDeletionService.deleteAccount.mock.calls).toEqual([
      [4],
      [5],
    ]);
    expect(
      fixture.repository.deleteExpiredDeletionRequests,
    ).toHaveBeenCalledWith(expect.any(Date));
  });
});
