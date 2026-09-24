import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../../prisma/prisma.service';
import type {
  DueEventReminder,
  EventReminderInput,
  EventReminderRecord,
  IEventReminderRepository,
} from './event-reminder.repository.interface';

@Injectable()
export class EventReminderPrismaRepository implements IEventReminderRepository {
  constructor(private readonly prismaService: PrismaService) {}

  async findByEventAndMember(
    eventId: number,
    memberId: number,
  ): Promise<EventReminderRecord[]> {
    return this.prismaService.eventReminder.findMany({
      where: { eventId, memberId },
      orderBy: { leadMinutes: 'asc' },
    });
  }

  async replace(
    eventId: number,
    memberId: number,
    inputs: EventReminderInput[],
  ): Promise<EventReminderRecord[]> {
    return this.prismaService.$transaction(async (tx) => {
      await tx.eventReminder.deleteMany({ where: { eventId, memberId } });

      if (inputs.length === 0) return [];

      await tx.eventReminder.createMany({
        data: inputs.map((input) => ({
          eventId,
          memberId,
          leadMinutes: input.leadMinutes,
          remindAt: input.remindAt,
          utcOffsetMinutes: input.utcOffsetMinutes,
        })),
      });

      return tx.eventReminder.findMany({
        where: { eventId, memberId },
        orderBy: { leadMinutes: 'asc' },
      });
    });
  }

  async deleteByEventAndMember(
    eventId: number,
    memberId: number,
  ): Promise<number> {
    const result = await this.prismaService.eventReminder.deleteMany({
      where: { eventId, memberId },
    });
    return result.count;
  }

  async deleteByEventAndMembersNotIn(
    eventId: number,
    memberIds: number[],
  ): Promise<number> {
    const result = await this.prismaService.eventReminder.deleteMany({
      where: { eventId, memberId: { notIn: memberIds } },
    });
    return result.count;
  }

  async rescheduleUnsent(eventId: number, startAt: Date): Promise<number> {
    const pending = await this.prismaService.eventReminder.findMany({
      where: { eventId, sentAt: null },
      select: { id: true, leadMinutes: true },
    });

    let updated = 0;
    for (const reminder of pending) {
      await this.prismaService.eventReminder.update({
        where: { id: reminder.id },
        data: {
          remindAt: new Date(startAt.getTime() - reminder.leadMinutes * 60000),
        },
      });
      updated += 1;
    }

    return updated;
  }

  async purgeExpired(now: Date): Promise<number> {
    const result = await this.prismaService.eventReminder.deleteMany({
      where: {
        OR: [
          { sentAt: { not: null } },
          { event: { deletedAt: { not: null } } },
          { event: { startAt: { lte: now } } },
        ],
      },
    });
    return result.count;
  }

  async claimDue(now: Date): Promise<DueEventReminder[]> {
    return this.prismaService.$transaction(async (tx) => {
      const due = await tx.eventReminder.findMany({
        where: {
          sentAt: null,
          remindAt: { lte: now },
          event: {
            deletedAt: null,
            startAt: { gt: now },
          },
        },
        select: {
          id: true,
          memberId: true,
          utcOffsetMinutes: true,
          event: {
            select: {
              id: true,
              name: true,
              startAt: true,
              groupId: true,
              members: { select: { memberId: true } },
            },
          },
          member: {
            select: {
              id: true,
              userId: true,
              notificationsEnabled: true,
              user: { select: { notificationsEnabled: true } },
            },
          },
        },
      });

      const eligible = due.filter(
        (reminder) =>
          reminder.member.notificationsEnabled &&
          reminder.member.user.notificationsEnabled &&
          reminder.event.members.some(
            (eventMember) => eventMember.memberId === reminder.memberId,
          ),
      );

      if (eligible.length === 0) return [];

      const ids = eligible.map((reminder) => reminder.id);
      await tx.eventReminder.updateMany({
        where: { id: { in: ids }, sentAt: null },
        data: { sentAt: now },
      });

      return eligible.map((reminder) => ({
        id: reminder.id,
        eventId: reminder.event.id,
        eventName: reminder.event.name,
        eventStartAt: reminder.event.startAt,
        groupId: reminder.event.groupId,
        memberId: reminder.memberId,
        userId: reminder.member.userId,
        utcOffsetMinutes: reminder.utcOffsetMinutes,
      }));
    });
  }
}
