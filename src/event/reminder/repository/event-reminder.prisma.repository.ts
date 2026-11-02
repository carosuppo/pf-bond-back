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
    const event = await this.prismaService.event.findUniqueOrThrow({
      where: { id: eventId },
    });
    if (event.recurrenceId !== null) {
      const settings =
        await this.prismaService.eventRecurrenceReminder.findMany({
          where: { recurrenceId: event.recurrenceId, memberId },
          orderBy: { leadMinutes: 'asc' },
        });
      return settings.map((setting) => ({
        ...setting,
        eventId,
        sentAt: null,
        remindAt: new Date(
          event.startAt.getTime() - setting.leadMinutes * 60000,
        ),
      }));
    }
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
      const event = await tx.event.findUniqueOrThrow({
        where: { id: eventId },
      });
      if (event.recurrenceId !== null) {
        const recurrenceId = event.recurrenceId;
        await tx.$queryRaw`SELECT "id" FROM "EventRecurrence" WHERE "id" = ${recurrenceId} FOR UPDATE`;
        await tx.eventRecurrenceReminder.deleteMany({
          where: { recurrenceId, memberId },
        });
        await tx.eventRecurrenceReminder.createMany({
          data: inputs.map((input) => ({
            recurrenceId,
            memberId,
            leadMinutes: input.leadMinutes,
            utcOffsetMinutes: input.utcOffsetMinutes,
          })),
        });
        const now = new Date();
        await tx.eventReminder.deleteMany({
          where: {
            memberId,
            sentAt: null,
            event: { recurrenceId, startAt: { gt: now } },
          },
        });
        const occurrences = await tx.event.findMany({
          where: {
            recurrenceId,
            deletedAt: null,
            startAt: { gt: now },
            members: { some: { memberId } },
          },
          select: { id: true, startAt: true },
        });
        await tx.eventReminder.createMany({
          skipDuplicates: true,
          data: occurrences.flatMap((occurrence) =>
            inputs
              .filter(
                (input) =>
                  occurrence.startAt.getTime() - input.leadMinutes * 60000 >
                  now.getTime(),
              )
              .map((input) => ({
                eventId: occurrence.id,
                memberId,
                leadMinutes: input.leadMinutes,
                utcOffsetMinutes: input.utcOffsetMinutes,
                remindAt: new Date(
                  occurrence.startAt.getTime() - input.leadMinutes * 60000,
                ),
              })),
          ),
        });
        const settings = await tx.eventRecurrenceReminder.findMany({
          where: { recurrenceId, memberId },
          orderBy: { leadMinutes: 'asc' },
        });
        return settings.map((setting) => ({
          ...setting,
          eventId,
          sentAt: null,
          remindAt: new Date(
            event.startAt.getTime() - setting.leadMinutes * 60000,
          ),
        }));
      }
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
    const records = await this.findByEventAndMember(eventId, memberId);
    await this.replace(eventId, memberId, []);
    return records.length;
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
    const event = await this.prismaService.event.findUniqueOrThrow({
      where: { id: eventId },
    });
    if (event.recurrenceId !== null) {
      const recurrenceId = event.recurrenceId;
      return this.prismaService.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT "id" FROM "EventRecurrence" WHERE "id" = ${recurrenceId} FOR UPDATE`;
        const members = await tx.eventMember.findMany({
          where: { eventId },
          select: { memberId: true },
        });
        const settings = await tx.eventRecurrenceReminder.findMany({
          where: {
            recurrenceId,
            memberId: { in: members.map((member) => member.memberId) },
          },
        });
        await tx.eventReminder.deleteMany({ where: { eventId, sentAt: null } });
        const now = Date.now();
        const result = await tx.eventReminder.createMany({
          skipDuplicates: true,
          data: settings
            .filter(
              (setting) =>
                startAt.getTime() - setting.leadMinutes * 60000 > now,
            )
            .map((setting) => ({
              eventId,
              memberId: setting.memberId,
              leadMinutes: setting.leadMinutes,
              utcOffsetMinutes: setting.utcOffsetMinutes,
              remindAt: new Date(
                startAt.getTime() - setting.leadMinutes * 60000,
              ),
            })),
        });
        return result.count;
      });
    }
    const pending = await this.prismaService.eventReminder.findMany({
      where: { eventId, sentAt: null },
      select: { id: true, leadMinutes: true },
    });

    let updated = 0;
    for (const reminder of pending) {
      const remindAt = new Date(
        startAt.getTime() - reminder.leadMinutes * 60000,
      );
      if (remindAt.getTime() <= Date.now()) {
        await this.prismaService.eventReminder.deleteMany({
          where: { id: reminder.id, sentAt: null },
        });
        continue;
      }
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
          { sentAt: { not: null }, event: { recurrenceId: null } },
          { event: { deletedAt: { not: null } } },
          { event: { startAt: { lte: now } } },
          {
            event: { recurrenceId: { not: null } },
            remindAt: { lt: new Date(now.getTime() - 60_000) },
          },
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
          OR: [
            { event: { recurrenceId: null } },
            { remindAt: { gte: new Date(now.getTime() - 60_000) } },
          ],
          event: {
            deletedAt: null,
            startAt: { gt: now },
          },
        },
        select: {
          id: true,
          memberId: true,
          leadMinutes: true,
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

      const claimed: typeof eligible = [];
      for (const reminder of eligible) {
        const result = await tx.eventReminder.updateMany({
          where: {
            id: reminder.id,
            sentAt: null,
            event: {
              deletedAt: null,
              startAt: { gt: now },
              members: { some: { memberId: reminder.memberId } },
            },
            member: {
              notificationsEnabled: true,
              user: { notificationsEnabled: true },
            },
          },
          data: { sentAt: now },
        });
        if (result.count === 1) claimed.push(reminder);
      }
      return claimed.map((reminder) => ({
        id: reminder.id,
        eventId: reminder.event.id,
        eventName: reminder.event.name,
        eventStartAt: reminder.event.startAt,
        leadMinutes: reminder.leadMinutes,
        groupId: reminder.event.groupId,
        memberId: reminder.memberId,
        userId: reminder.member.userId,
        utcOffsetMinutes: reminder.utcOffsetMinutes,
      }));
    });
  }
}
