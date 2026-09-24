import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';

import { NotificationService } from '../../notification/notification.service';
import type { IEventRepository } from '../repository/event.repository.interface';
import { EventValidator } from '../validator/event.validator';
import {
  EventReminderResponseDto,
  EventRemindersResponseDto,
} from './dto/event-reminder-response.dto';
import { SetEventRemindersDto } from './dto/set-event-reminders.dto';
import type {
  EventReminderInput,
  EventReminderRecord,
  IEventReminderRepository,
} from './repository/event-reminder.repository.interface';

export const MIN_REMINDER_LEAD_MINUTES = 1;
export const MAX_REMINDER_LEAD_MINUTES = 40320;

@Injectable()
export class EventReminderService {
  private readonly logger = new Logger(EventReminderService.name);

  constructor(
    @Inject('eventReminderRepository')
    private readonly eventReminderRepository: IEventReminderRepository,
    @Inject('eventRepository')
    private readonly eventRepository: IEventRepository,
    @Inject('eventValidator')
    private readonly eventValidator: EventValidator,
    private readonly notificationService: NotificationService,
  ) {}

  async getMyReminders(
    eventId: number,
    groupId: number,
    userId: number,
  ): Promise<EventReminderResponseDto[]> {
    const { memberId } = await this.requireActiveEventMember(
      userId,
      groupId,
      eventId,
    );
    const records = await this.eventReminderRepository.findByEventAndMember(
      eventId,
      memberId,
    );
    return records
      .filter((record) => record.sentAt === null)
      .map((record) => this.toResponse(record));
  }

  async setMyReminders(
    dto: SetEventRemindersDto,
    eventId: number,
    groupId: number,
    userId: number,
  ): Promise<EventRemindersResponseDto> {
    const { memberId, startAt } = await this.requireActiveEventMember(
      userId,
      groupId,
      eventId,
    );

    if (startAt.getTime() <= Date.now()) {
      throw new BadRequestException(
        'El evento ya comenzó y no admite recordatorios.',
      );
    }

    const seen = new Map<number, number | null>();
    dto.reminders.forEach((item) => {
      if (!seen.has(item.leadMinutes)) {
        seen.set(item.leadMinutes, item.utcOffsetMinutes ?? null);
      }
    });
    const now = Date.now();

    seen.forEach((_, lead) => {
      if (
        lead < MIN_REMINDER_LEAD_MINUTES ||
        lead > MAX_REMINDER_LEAD_MINUTES
      ) {
        throw new BadRequestException(
          `La anticipación debe estar entre ${MIN_REMINDER_LEAD_MINUTES} minuto y ${MAX_REMINDER_LEAD_MINUTES} minutos (4 semanas).`,
        );
      }
      if (startAt.getTime() - lead * 60000 <= now) {
        throw new BadRequestException(
          `La anticipación de ${lead} minutos ya pasó para este evento.`,
        );
      }
    });

    const inputs: EventReminderInput[] = [];
    seen.forEach((utcOffsetMinutes, lead) => {
      inputs.push({
        leadMinutes: lead,
        remindAt: new Date(startAt.getTime() - lead * 60000),
        utcOffsetMinutes,
      });
    });

    const records = await this.eventReminderRepository.replace(
      eventId,
      memberId,
      inputs,
    );

    return {
      reminders: records.map((record) => this.toResponse(record)),
    };
  }

  async deleteMyReminders(
    eventId: number,
    groupId: number,
    userId: number,
  ): Promise<void> {
    const { memberId } = await this.requireActiveEventMember(
      userId,
      groupId,
      eventId,
    );
    await this.eventReminderRepository.deleteByEventAndMember(
      eventId,
      memberId,
    );
  }

  async rescheduleForEvent(eventId: number, startAt: Date): Promise<void> {
    await this.eventReminderRepository.rescheduleUnsent(eventId, startAt);
  }

  async purgeRemovedMembers(
    eventId: number,
    memberIds: number[],
  ): Promise<void> {
    await this.eventReminderRepository.deleteByEventAndMembersNotIn(
      eventId,
      memberIds,
    );
  }

  async sendDueReminders(now: Date = new Date()): Promise<number> {
    const due = await this.eventReminderRepository.claimDue(now);

    for (const reminder of due) {
      try {
        await this.notificationService.sendToUser(reminder.userId, {
          title: 'Recordatorio de evento',
          body:
            `El evento "${reminder.eventName}" comienza ` +
            `el ${this.formatInTimezone(reminder.eventStartAt, reminder.utcOffsetMinutes)}.`,
          data: {
            type: 'EVENT_REMINDER',
            groupId: String(reminder.groupId),
            eventId: String(reminder.eventId),
            eventName: reminder.eventName,
            startAt: reminder.eventStartAt.toISOString(),
          },
          ttlSeconds: Math.max(
            0,
            Math.floor(
              (reminder.eventStartAt.getTime() - now.getTime()) / 1000,
            ),
          ),
        });
      } catch (error: unknown) {
        const message =
          error instanceof Error ? error.message : 'Error desconocido';
        this.logger.error(
          `No se pudo enviar el recordatorio ${reminder.id} del evento ${reminder.eventId}: ${message}`,
        );
      }
    }

    await this.eventReminderRepository.purgeExpired(now);

    return due.length;
  }

  private async requireActiveEventMember(
    userId: number,
    groupId: number,
    eventId: number,
  ): Promise<{ memberId: number; startAt: Date }> {
    const member = await this.eventValidator.requireMembership(userId, groupId);
    const event = await this.eventRepository.findByIdAndMemberId(
      eventId,
      member.id,
    );

    if (!event || event.groupId !== groupId) {
      throw new NotFoundException('El evento no existe.');
    }

    return { memberId: member.id, startAt: event.startAt };
  }

  private toResponse(record: EventReminderRecord): EventReminderResponseDto {
    return {
      id: record.id,
      leadMinutes: record.leadMinutes,
      remindAt: record.remindAt,
      sentAt: record.sentAt,
    };
  }

  private formatInTimezone(
    date: Date,
    utcOffsetMinutes: number | null,
  ): string {
    const shifted = new Date(date.getTime() + (utcOffsetMinutes ?? 0) * 60000);
    const day = String(shifted.getUTCDate()).padStart(2, '0');
    const month = String(shifted.getUTCMonth() + 1).padStart(2, '0');
    const year = shifted.getUTCFullYear();
    const hours = String(shifted.getUTCHours()).padStart(2, '0');
    const minutes = String(shifted.getUTCMinutes()).padStart(2, '0');
    return `${day}/${month}/${year} a las ${hours}:${minutes}hs`;
  }
}
