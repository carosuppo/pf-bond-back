import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { logErrorSafely, logSafely } from '../../common/logging/error-logging';

import { EventReminderService } from './event-reminder.service';

@Injectable()
export class EventReminderScheduler {
  private readonly logger = new Logger(EventReminderScheduler.name);
  private running = false;

  constructor(private readonly eventReminderService: EventReminderService) {}

  @Cron('* * * * *')
  async handleCron(): Promise<void> {
    if (this.running) return;
    this.running = true;

    try {
      const sent = await this.eventReminderService.sendDueReminders();
      if (sent > 0) {
        logSafely(
          this.logger,
          'log',
          `operation=sendDueEventReminders outcome=completed count=${sent}`,
        );
      }
    } catch (error: unknown) {
      logErrorSafely(
        this.logger,
        'operation=sendDueEventReminders outcome=error',
        error,
      );
    } finally {
      this.running = false;
    }
  }
}
