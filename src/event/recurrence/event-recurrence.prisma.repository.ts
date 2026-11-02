import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateEventData } from '../interface/create-event.interface';
import { EventRecurrenceDto } from '../dto/event-recurrence.dto';
import { IEventRecurrenceRepository } from './event-recurrence.repository.interface';
import { occurrenceAt, occurrenceDates } from './recurrence-calendar';

@Injectable()
export class EventRecurrencePrismaRepository implements IEventRecurrenceRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    data: CreateEventData,
    recurrence: EventRecurrenceDto,
    groupId: number,
    userId: number,
  ) {
    return this.prisma.$transaction(
      async (tx) => {
        const creator = await tx.member.findUniqueOrThrow({
          where: { userId_groupId: { userId, groupId } },
        });
        const memberIds = [...new Set([creator.id, ...data.memberIds])];
        const series = await tx.eventRecurrence.create({
          data: {
            name: data.name,
            description: data.description,
            startAt: data.startAt,
            endAt: data.endAt,
            groupId,
            frequency: recurrence.frequency,
            until: recurrence.until,
            members: { create: memberIds.map((memberId) => ({ memberId })) },
          },
        });
        await this.generate(
          tx,
          series.id,
          data.startAt,
          occurrenceAt(data.startAt, 'DAILY', 60),
        );
        const event = await tx.event.findFirstOrThrow({
          where: { recurrenceId: series.id },
          orderBy: { occurrenceAt: 'asc' },
        });
        return { ...event, memberIds, location: null };
      },
      { timeout: 30_000 },
    );
  }

  async ensure(from: Date, through: Date, groupId?: number): Promise<void> {
    // Each transaction is bounded to a calendar window and locks only one series.
    const series = await this.prisma.eventRecurrence.findMany({
      where: { groupId, group: { deletedAt: null }, startAt: { lte: through } },
      select: { id: true },
    });
    for (const { id } of series) {
      await this.prisma.$transaction(
        (tx) => this.generate(tx, id, from, through),
        { timeout: 30_000 },
      );
    }
  }

  private async generate(
    tx: Prisma.TransactionClient,
    id: number,
    from: Date,
    through: Date,
  ): Promise<void> {
    await tx.$queryRaw`SELECT "id" FROM "EventRecurrence" WHERE "id" = ${id} FOR UPDATE`;
    const series = await tx.eventRecurrence.findUniqueOrThrow({
      where: { id },
      include: { members: true, reminders: true },
    });
    const duration =
      series.endAt === null
        ? null
        : series.endAt.getTime() - series.startAt.getTime();
    const overlapFrom = new Date(from.getTime() - (duration ?? 0));
    const dates = occurrenceDates(
      series.startAt,
      series.frequency,
      series.until,
      overlapFrom,
      through,
    );
    const existing = await tx.event.findMany({
      where: { recurrenceId: id, occurrenceAt: { in: dates } },
      select: { occurrenceAt: true },
    });
    const occupied = new Set(
      existing.map((event) => event.occurrenceAt!.getTime()),
    );
    for (const startAt of dates) {
      // occurrenceAt is immutable even when startAt changes or the event is cancelled.
      if (occupied.has(startAt.getTime())) continue;
      const now = Date.now();
      await tx.event.create({
        data: {
          recurrenceId: id,
          occurrenceAt: startAt,
          startAt,
          endAt:
            duration === null ? null : new Date(startAt.getTime() + duration),
          name: series.name,
          description: series.description,
          groupId: series.groupId,
          members: {
            create: series.members.map(({ memberId }) => ({ memberId })),
          },
          reminders: {
            create: series.reminders
              .filter(
                (r) =>
                  series.members.some((m) => m.memberId === r.memberId) &&
                  startAt.getTime() - r.leadMinutes * 60_000 > now,
              )
              .map((r) => ({
                memberId: r.memberId,
                leadMinutes: r.leadMinutes,
                utcOffsetMinutes: r.utcOffsetMinutes,
                remindAt: new Date(startAt.getTime() - r.leadMinutes * 60_000),
              })),
          },
        },
      });
    }
  }
}
