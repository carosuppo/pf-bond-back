import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { logErrorSafely } from '../../common/logging/error-logging';
import { AccountDeletionRequestService } from './account-deletion-request.service';

@Injectable()
export class UnverifiedAccountRetentionScheduler {
  private readonly logger = new Logger(
    UnverifiedAccountRetentionScheduler.name,
  );

  constructor(
    private readonly accountDeletionRequestService: AccountDeletionRequestService,
  ) {}

  @Cron('* * * * *', { timeZone: 'UTC' })
  async purgeExpiredAccounts(): Promise<void> {
    try {
      await this.accountDeletionRequestService.purgeExpiredUnverifiedAccounts();
    } catch (error: unknown) {
      logErrorSafely(
        this.logger,
        'operation=purgeExpiredUnverifiedAccounts outcome=error',
        error,
      );
    }
  }
}
