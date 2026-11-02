import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import type { IEventRecurrenceRepository } from './event-recurrence.repository.interface';
import { CreateEventData } from '../interface/create-event.interface';
import { EventRecurrenceDto } from '../dto/event-recurrence.dto';
import { calendarRange, occurrenceAt } from './recurrence-calendar';

@Injectable()
export class EventRecurrenceService {
  private readonly logger = new Logger(EventRecurrenceService.name);
  constructor(
    @Inject('eventRecurrenceRepository')
    private readonly repository: IEventRecurrenceRepository,
  ) {}

  create(
    data: CreateEventData,
    recurrence: EventRecurrenceDto,
    groupId: number,
    userId: number,
  ) {
    if (!['DAILY', 'WEEKLY', 'MONTHLY'].includes(recurrence.frequency)) {
      throw new BadRequestException(
        'La periodicidad debe ser DAILY, WEEKLY o MONTHLY.',
      );
    }
    if (
      recurrence.until != null &&
      (!Number.isFinite(recurrence.until.getTime()) ||
        recurrence.until <= data.startAt)
    ) {
      throw new BadRequestException(
        'La fecha final de la recurrencia debe ser posterior al inicio.',
      );
    }
    return this.repository.create(data, recurrence, groupId, userId);
  }

  ensureCalendar(groupId: number, year: number, month?: number) {
    const { from, through } = calendarRange(year, month);
    return this.repository.ensure(from, through, groupId);
  }

  @Cron('0 * * * *')
  async handleCron(): Promise<void> {
    const now = new Date();
    try {
      await this.repository.ensure(now, occurrenceAt(now, 'DAILY', 60));
    } catch (error: unknown) {
      this.logger.error(
        'No se pudieron generar las recurrencias.',
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
}
