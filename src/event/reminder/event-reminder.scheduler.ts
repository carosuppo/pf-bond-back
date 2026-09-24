import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';

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
        this.logger.log(`Recordatorios de evento enviados: ${sent}.`);
      }
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Error desconocido';
      this.logger.error(
        `Falló el envío de recordatorios de evento: ${message}`,
      );
    } finally {
      this.running = false;
    }
  }
}
