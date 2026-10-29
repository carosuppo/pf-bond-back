import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { logErrorSafely } from '../common/logging/error-logging';
import type { ISecurityEventRepository } from './repository/security-event.repository.interface';
import { getSecurityEventRetentionCutoff } from './security-event-retention';

@Injectable()
export class SecurityEventRetentionScheduler {
  private readonly logger = new Logger(SecurityEventRetentionScheduler.name);

  constructor(
    @Inject('securityEventRepository')
    private readonly repository: ISecurityEventRepository,
  ) {}

  @Cron('0 0 * * *', { timeZone: 'UTC' })
  async purgeExpiredEvents(): Promise<void> {
    try {
      await this.repository.deleteOlderThan(
        getSecurityEventRetentionCutoff(new Date()),
      );
    } catch (error: unknown) {
      logErrorSafely(
        this.logger,
        'operation=purgeSecurityEvents outcome=error',
        error,
      );
    }
  }
}
