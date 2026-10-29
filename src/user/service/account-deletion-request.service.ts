import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes } from 'crypto';
import { logErrorSafely } from '../../common/logging/error-logging';
import { MailService } from '../../mail/mail.service';
import { EMAIL_VERIFICATION_DURATION_MS } from '../constants/email-verification.constants';
import type { IAccountDeletionRepository } from '../repository/account-deletion.repository.interface';
import type { IUserRepository } from '../repository/user.repository.interface';
import { AccountDeletionService } from './account-deletion.service';

const ACCOUNT_DELETION_REQUEST_DURATION_HOURS = 24;
const ACCOUNT_DELETION_REQUEST_COOLDOWN_MINUTES = 15;

@Injectable()
export class AccountDeletionRequestService {
  private readonly logger = new Logger(AccountDeletionRequestService.name);

  constructor(
    @Inject('accountDeletionRepository')
    private readonly repository: IAccountDeletionRepository,
    @Inject('userRepository')
    private readonly userRepository: IUserRepository,
    private readonly mailService: MailService,
    private readonly configService: ConfigService,
    private readonly accountDeletionService: AccountDeletionService,
  ) {}

  async request(email: string): Promise<void> {
    const apiBaseUrl = this.getRequiredEnv('API_BASE_URL');
    const user = await this.userRepository.findByEmail(
      email.trim().toLowerCase(),
    );
    if (!user) return;

    const now = new Date();
    const token = randomBytes(32).toString('base64url');
    const tokenHash = this.hashToken(token);
    const expiresAt = new Date(
      now.getTime() + ACCOUNT_DELETION_REQUEST_DURATION_HOURS * 60 * 60 * 1000,
    );
    const cooldownStartedAt = new Date(
      now.getTime() - ACCOUNT_DELETION_REQUEST_COOLDOWN_MINUTES * 60 * 1000,
    );
    const created = await this.repository.createDeletionRequest(
      user.id,
      tokenHash,
      expiresAt,
      now,
      cooldownStartedAt,
    );
    if (!created) return;

    const configuredLegalBaseUrl =
      this.configService.get<string>('LEGAL_BASE_URL') ??
      new URL('/legal/', apiBaseUrl).toString();
    const legalBaseUrl = configuredLegalBaseUrl.endsWith('/')
      ? configuredLegalBaseUrl
      : `${configuredLegalBaseUrl}/`;
    const confirmationUrl = new URL('account-deletion/confirm/', legalBaseUrl);
    confirmationUrl.hash = token;

    try {
      await this.mailService.sendAccountDeletionConfirmation(
        user.email,
        user.name,
        confirmationUrl.toString(),
      );
    } catch (error: unknown) {
      await this.repository.cancelDeletionRequest(user.id, tokenHash);
      logErrorSafely(
        this.logger,
        'operation=requestAccountDeletionEmail outcome=error',
        error,
      );
    }
  }

  async confirm(token: string): Promise<void> {
    const userId = await this.repository.consumeDeletionRequest(
      this.hashToken(token),
      new Date(),
    );
    if (userId === null) {
      throw new BadRequestException(
        'El enlace de eliminación es inválido, ya fue usado o expiró.',
      );
    }

    await this.accountDeletionService.deleteAccount(userId);
  }

  async purgeExpiredUnverifiedAccounts(): Promise<void> {
    const now = new Date();
    const createdBefore = new Date(
      now.getTime() - EMAIL_VERIFICATION_DURATION_MS,
    );
    const userIds = await this.repository.findExpiredUnverifiedUserIds(
      now,
      createdBefore,
    );

    for (const userId of userIds) {
      try {
        await this.accountDeletionService.deleteAccount(userId);
      } catch (error: unknown) {
        logErrorSafely(
          this.logger,
          'operation=purgeExpiredUnverifiedAccount outcome=error',
          error,
        );
      }
    }

    await this.repository.deleteExpiredDeletionRequests(now);
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private getRequiredEnv(key: string): string {
    const value = this.configService.get<string>(key);
    if (!value)
      throw new Error(`La variable de entorno ${key} no está definida.`);
    return value;
  }
}
