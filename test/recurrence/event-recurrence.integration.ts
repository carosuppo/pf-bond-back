import 'reflect-metadata';
// Execute the real scheduled method explicitly; do not start timers in this suite.
jest.mock('@nestjs/schedule', () => ({ Cron: () => () => undefined }));
import { Client } from 'pg';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  ExecutionContext,
  INestApplication,
  ValidationPipe,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { EventController } from '../../src/event/event.controller';
import { SessionAuthGuard } from '../../src/user/guard/session-auth.guard';
import { PrismaService } from '../../src/prisma/prisma.service';
import { EventRecurrencePrismaRepository } from '../../src/event/recurrence/event-recurrence.prisma.repository';
import { EventRecurrenceService } from '../../src/event/recurrence/event-recurrence.service';
import { EventPrismaRepository } from '../../src/event/repository/event.prisma.repository';
import { EventReminderPrismaRepository } from '../../src/event/reminder/repository/event-reminder.prisma.repository';
import { EventReminderService } from '../../src/event/reminder/event-reminder.service';
import { EventService } from '../../src/event/event.service';
import { EventValidator } from '../../src/event/validator/event.validator';
import { MemberPrismaRepository } from '../../src/member/repository/member.prisma.repository';
import { GroupPrismaRepository } from '../../src/group/repository/group.prisma.repository';
import { NotificationService } from '../../src/notification/notification.service';
import { occurrenceAt } from '../../src/event/recurrence/recurrence-calendar';

describe('BND-125 isolated PostgreSQL', () => {
  // No application URL or credentials are read or changed. Only a unique test schema is removed.
  const connectionString = 'postgresql://postgres@127.0.0.1:55439/postgres';
  const schema = `bnd125_${process.pid}_${Date.now()}`;
  const sql = new Client({ connectionString });
  let db: PrismaClient;
  let app: INestApplication<App>;
  let recurrence: EventRecurrenceService;
  let events: EventService;
  let reminders: EventReminderService;
  let reminderRepo: EventReminderPrismaRepository;
  let emitter: EventEmitter2;
  let emitSpy: jest.SpiedFunction<EventEmitter2['emit']>;
  let groupId: number;
  let userId: number;
  let otherUserId: number;
  let memberId: number;
  let otherMemberId: number;
  const sendToUser = jest.fn().mockResolvedValue(undefined);
  const startAt = new Date('2090-01-31T22:00:00Z');
  const data = () => ({
    name: 'Gimnasio',
    description: 'Serie',
    startAt,
    endAt: new Date(startAt.getTime() + 90 * 60000),
    memberIds: [otherMemberId],
  });

  beforeAll(async () => {
    await sql.connect();
    await sql.query(
      `CREATE SCHEMA "${schema}"; SET search_path TO "${schema}"`,
    );
    const ddl = execFileSync(
      process.execPath,
      [
        'node_modules/prisma/build/index.js',
        'migrate',
        'diff',
        '--from-empty',
        '--to-schema',
        'prisma/schema.prisma',
        '--script',
      ],
      { cwd: join(__dirname, '../..'), encoding: 'utf8' },
    );
    await sql.query(ddl.replace('CREATE SCHEMA IF NOT EXISTS "public";', ''));
    // Reconstruct the pre-feature state, then apply the actual additive migration.
    await sql.query(
      'ALTER TABLE "Event" DROP COLUMN "recurrenceId", DROP COLUMN "occurrenceAt"; DROP INDEX "Event_groupId_startAt_idx"; DROP TABLE "EventRecurrenceReminder", "EventRecurrenceMember", "EventRecurrence"; DROP TYPE "EventRecurrenceFrequency";',
    );
    await sql.query(
      'INSERT INTO "Group" (name,image,"invitationCode","updatedAt") VALUES (\'Legacy\',\'\',\'legacy\',now()); INSERT INTO "Event" (name,"startAt","groupId","updatedAt") VALUES (\'Preserved\',now(),1,now());',
    );
    await sql.query(
      readFileSync(
        join(
          __dirname,
          '../../prisma/migrations/20261030220000_event_recurrence/migration.sql',
        ),
        'utf8',
      ),
    );
    expect(
      (await sql.query<{ name: string }>('SELECT name FROM "Event" WHERE id=1'))
        .rows[0].name,
    ).toBe('Preserved');
    db = new PrismaClient({
      adapter: new PrismaPg(
        { connectionString, options: `-c search_path=${schema}` },
        { schema },
      ),
    });
    const prisma = db as PrismaService;
    const eventRepo = new EventPrismaRepository(prisma);
    reminderRepo = new EventReminderPrismaRepository(prisma);
    const validator = new EventValidator(
      eventRepo,
      new MemberPrismaRepository(prisma),
      new GroupPrismaRepository(prisma),
    );
    recurrence = new EventRecurrenceService(
      new EventRecurrencePrismaRepository(prisma),
    );
    emitter = new EventEmitter2();
    emitSpy = jest.spyOn(emitter, 'emit');
    reminders = new EventReminderService(reminderRepo, eventRepo, validator, {
      sendToUser,
    } as unknown as NotificationService);
    events = new EventService(
      eventRepo,
      validator,
      emitter,
      reminders,
      recurrence,
    );
    groupId = (
      await db.group.create({
        data: { name: 'Test', image: '', invitationCode: schema },
      })
    ).id;
    userId = (
      await db.user.create({
        data: { name: 'A', email: 'a@test', passwordHash: '' },
      })
    ).id;
    otherUserId = (
      await db.user.create({
        data: { name: 'B', email: 'b@test', passwordHash: '' },
      })
    ).id;
    memberId = (
      await db.member.create({ data: { groupId, userId, role: 'ADMIN' } })
    ).id;
    otherMemberId = (
      await db.member.create({
        data: { groupId, userId: otherUserId, role: 'MEMBER' },
      })
    ).id;
  });

  afterAll(async () => {
    await app?.close();
    await db?.$disconnect();
    if (/^bnd125_\d+_\d+$/.test(schema))
      await sql.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    await sql.end();
  });

  it('validates HTTP payloads and group membership through the existing endpoint', async () => {
    const module = await Test.createTestingModule({
      controllers: [EventController],
      providers: [{ provide: EventService, useValue: events }],
    })
      .overrideGuard(SessionAuthGuard)
      .useValue({
        canActivate(context: ExecutionContext) {
          const req = context.switchToHttp().getRequest<{
            user: { id: number };
            headers: Record<string, string>;
          }>();
          req.user = { id: Number(req.headers['x-test-user']) };
          return true;
        },
      })
      .compile();
    app = module.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ transform: true, whitelist: true }),
    );
    await app.init();
    const path = `/group/${groupId}/event`;
    await request(app.getHttpServer())
      .post(path)
      .set('x-test-user', String(userId))
      .send({ ...data(), recurrence: { frequency: 'YEARLY' } })
      .expect(400);
    await request(app.getHttpServer())
      .post(path)
      .set('x-test-user', '999999')
      .send({ ...data(), recurrence: { frequency: 'DAILY' } })
      .expect(403);
    await request(app.getHttpServer())
      .post(path)
      .set('x-test-user', String(userId))
      .send({ ...data(), recurrence: { frequency: 'MONTHLY', until: null } })
      .expect(201);
    await request(app.getHttpServer())
      .get(`${path}?year=2091&month=2`)
      .set('x-test-user', String(userId))
      .expect(200);
  });

  it.each(['DAILY', 'WEEKLY', 'MONTHLY'] as const)(
    'creates %s transactionally with members, duration and one notification',
    async (frequency) => {
      emitSpy.mockClear();
      const created = await events.createEvent(
        { ...data(), recurrence: { frequency } },
        groupId,
        userId,
      );
      const rows = await db.event.findMany({
        where: { recurrenceId: created.recurrenceId },
        include: { members: true },
        orderBy: { startAt: 'asc' },
      });
      expect(rows.length).toBe(
        frequency === 'DAILY' ? 61 : frequency === 'WEEKLY' ? 9 : 3,
      );
      expect(
        rows.every(
          (row) => row.endAt!.getTime() - row.startAt.getTime() === 90 * 60000,
        ),
      ).toBe(true);
      expect(
        rows.every(
          (row) =>
            row.members
              .map((m) => m.memberId)
              .sort()
              .join() === [memberId, otherMemberId].sort().join(),
        ),
      ).toBe(true);
      expect(emitSpy).toHaveBeenCalledTimes(1);
    },
  );

  it('keeps normal events unchanged and rejects invalid until and outsiders', async () => {
    const normal = await events.createEvent(data(), groupId, userId);
    expect(normal.recurrenceId).toBeNull();
    await expect(
      events.createEvent(
        { ...data(), recurrence: { frequency: 'DAILY', until: startAt } },
        groupId,
        userId,
      ),
    ).rejects.toThrow('posterior');
    await expect(
      events.createEvent(
        { ...data(), recurrence: { frequency: 'DAILY' } },
        groupId,
        999999,
      ),
    ).rejects.toThrow('perteneces');
    await expect(
      events.createEvent(
        { ...data(), memberIds: [999999], recurrence: { frequency: 'DAILY' } },
        groupId,
        userId,
      ),
    ).rejects.toThrow('pertenecen');
    const count = await db.eventRecurrence.count();
    await expect(
      new EventRecurrencePrismaRepository(db as PrismaService).create(
        { ...data(), memberIds: [999999] },
        { frequency: 'DAILY' },
        groupId,
        userId,
      ),
    ).rejects.toThrow();
    expect(await db.eventRecurrence.count()).toBe(count);
  });

  it('limits until, generates remote months concurrently, and preserves cancelled/edited occurrences', async () => {
    const created = await events.createEvent(
      {
        ...data(),
        recurrence: {
          frequency: 'MONTHLY',
          until: new Date('2091-03-31T22:00Z'),
        },
      },
      groupId,
      userId,
    );
    await events.updateEvent(
      {
        name: 'Only this one',
        startAt: new Date('2090-02-02T22:00Z'),
        endAt: new Date('2090-02-02T23:30Z'),
      },
      created.id,
      groupId,
      userId,
    );
    await events.cancelEvent(created.id, groupId, userId);
    await Promise.all([
      recurrence.ensureCalendar(groupId, 2091, 3),
      recurrence.ensureCalendar(groupId, 2091, 3),
    ]);
    await recurrence.ensureCalendar(groupId, 2090, 1);
    await recurrence.ensureCalendar(groupId, 2091, 4);
    const rows = await db.event.findMany({
      where: { recurrenceId: created.recurrenceId },
    });
    expect(rows).toHaveLength(4);
    expect(rows.find((row) => row.id === created.id)!.deletedAt).not.toBeNull();
    expect(rows.filter((row) => row.name === 'Gimnasio')).toHaveLength(3);
    expect(
      rows.find(
        (row) => row.startAt.toISOString() === '2091-03-31T22:00:00.000Z',
      ),
    ).toBeDefined();
  });

  it('persists independent reminder settings, creates future reminders and avoids duplicate delivery', async () => {
    const created = await events.createEvent(
      { ...data(), recurrence: { frequency: 'WEEKLY' } },
      groupId,
      userId,
    );
    await reminders.setMyReminders(
      { reminders: [{ leadMinutes: 60 }] },
      created.id,
      groupId,
      userId,
    );
    await reminders.setMyReminders(
      { reminders: [{ leadMinutes: 120 }] },
      created.id,
      groupId,
      otherUserId,
    );
    await Promise.all([
      recurrence.ensureCalendar(groupId, 2091, 1),
      recurrence.ensureCalendar(groupId, 2091, 1),
    ]);
    const later = await db.event.findFirstOrThrow({
      where: {
        recurrenceId: created.recurrenceId,
        startAt: { gte: new Date('2091-01-01') },
      },
      include: { reminders: true },
    });
    expect(later.reminders.map((r) => r.leadMinutes).sort()).toEqual([120, 60]);
    await reminders.setMyReminders(
      { reminders: [{ leadMinutes: 30 }] },
      created.id,
      groupId,
      userId,
    );
    expect(
      await db.eventReminder.count({
        where: {
          event: { recurrenceId: created.recurrenceId },
          memberId,
          leadMinutes: 60,
        },
      }),
    ).toBe(0);
    expect(
      await db.eventReminder.count({
        where: {
          event: { recurrenceId: created.recurrenceId },
          memberId: otherMemberId,
          leadMinutes: 120,
        },
      }),
    ).toBeGreaterThan(0);
    await reminders.deleteMyReminders(created.id, groupId, userId);
    expect(
      await db.eventRecurrenceReminder.count({
        where: { recurrenceId: created.recurrenceId, memberId },
      }),
    ).toBe(0);
    const now = new Date(startAt.getTime() - 120 * 60000);
    sendToUser.mockClear();
    await Promise.all([
      reminders.sendDueReminders(now),
      reminders.sendDueReminders(now),
    ]);
    expect(sendToUser).toHaveBeenCalledTimes(1);
    await reminders.sendDueReminders(occurrenceAt(now, 'WEEKLY', 1));
    expect(sendToUser).toHaveBeenCalledTimes(2);
    await events.cancelEvent(later.id, groupId, userId);
    expect(
      (
        await reminderRepo.claimDue(
          new Date(later.startAt.getTime() - 120 * 60000),
        )
      ).some((r) => r.eventId === later.id),
    ).toBe(false);
  });

  it('skips elapsed reminders and respects member notification preferences', async () => {
    const soon = new Date(Date.now() + 30 * 60000);
    const created = await events.createEvent(
      {
        ...data(),
        startAt: soon,
        endAt: undefined,
        recurrence: { frequency: 'DAILY' },
      },
      groupId,
      userId,
    );
    await reminders.setMyReminders(
      { reminders: [{ leadMinutes: 60 }] },
      created.id,
      groupId,
      userId,
    );
    expect(
      await db.eventReminder.count({ where: { eventId: created.id } }),
    ).toBe(0);
    expect(
      (await reminders.getMyReminders(created.id, groupId, userId)).map(
        (r) => r.leadMinutes,
      ),
    ).toEqual([60]);
    await db.member.update({
      where: { id: memberId },
      data: { notificationsEnabled: false },
    });
    const next = await db.event.findFirstOrThrow({
      where: { recurrenceId: created.recurrenceId, id: { not: created.id } },
      orderBy: { startAt: 'asc' },
    });
    const due = new Date(next.startAt.getTime() - 60 * 60000);
    expect(
      (await reminderRepo.claimDue(due)).some((r) => r.eventId === next.id),
    ).toBe(false);
    await db.member.update({
      where: { id: memberId },
      data: { notificationsEnabled: true },
    });
    expect(
      (await reminderRepo.claimDue(new Date(due.getTime() + 120000))).some(
        (r) => r.eventId === next.id,
      ),
    ).toBe(false);
    await recurrence.ensureCalendar(groupId, 2092, 5);
    const future = await db.event.findFirstOrThrow({
      where: {
        recurrenceId: created.recurrenceId,
        startAt: { gte: new Date('2092-05-01') },
      },
      include: { reminders: true },
    });
    expect(future.reminders).toHaveLength(1);
    // Moving only this occurrence restores its previously elapsed configuration.
    await events.updateEvent(
      { startAt: occurrenceAt(soon, 'DAILY', 3) },
      created.id,
      groupId,
      userId,
    );
    expect(
      await db.eventReminder.count({
        where: { eventId: created.id, memberId },
      }),
    ).toBe(1);
  });

  it('scheduler replenishes upcoming windows idempotently without creation notifications', async () => {
    const tomorrow = occurrenceAt(new Date(), 'DAILY', 1);
    const created = await events.createEvent(
      {
        ...data(),
        startAt: tomorrow,
        endAt: undefined,
        recurrence: { frequency: 'DAILY' },
      },
      groupId,
      userId,
    );
    emitSpy.mockClear();
    await Promise.all([recurrence.handleCron(), recurrence.handleCron()]);
    expect(
      await db.event.count({ where: { recurrenceId: created.recurrenceId } }),
    ).toBe(61);
    expect(emitSpy).not.toHaveBeenCalled();
  });
});
