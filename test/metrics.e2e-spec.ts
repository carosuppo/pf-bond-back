import { PrismaService } from '../src/prisma/prisma.service';
import { ActivityPrismaRepository } from '../src/metrics/activity.prisma.repository';

jest.setTimeout(30000);

const enabled = process.env.RUN_METRICS_DB_TESTS === '1';
(enabled ? describe : describe.skip)(
  'Sprint 6 metrics (isolated PostgreSQL)',
  () => {
    let prisma: PrismaService;
    beforeAll(async () => {
      const url = new URL(process.env.DATABASE_URL ?? '');
      if (
        !['127.0.0.1', 'localhost'].includes(url.hostname) ||
        !url.pathname.endsWith('_test')
      ) {
        throw new Error(
          'Metrics tests require a local database ending in _test',
        );
      }
      prisma = new PrismaService();
      await prisma.$connect();
    });
    afterAll(async () => {
      await prisma?.$disconnect();
    });

    it('calculates all aggregates, temporal boundaries and sharing without duplicates or personal columns', async () => {
      await prisma
        .$transaction(
          async (tx) => {
            // Empty, isolated test DB only. All fixtures are rolled back below.
            const empty = await tx.$queryRaw<
              Record<string, bigint | number>[]
            >`SELECT * FROM bond_metrics.sprint6`;
            expect(empty).toHaveLength(1);
            expect(
              Object.values(empty[0]).every((value) => Number(value) === 0),
            ).toBe(true);
            await tx.$executeRaw`INSERT INTO public."Location" (id, latitude, longitude, "capturedAt", "lastSeenAt", "updatedAt") VALUES
        (1, 0, 0, timezone('UTC', now()) - interval '1 minute', timezone('UTC', now()), now()),
        (2, 0, 0, timezone('UTC', now()) - interval '16 minutes', timezone('UTC', now()), now()),
        (3, 0, 0, NULL, timezone('UTC', now()), now()),
        (4, 0, 0, timezone('UTC', now()) + interval '1 hour', timezone('UTC', now()), now()),
        (5, 0, 0, timezone('UTC', now()) - interval '15 minutes', timezone('UTC', now()), now())`;
            await tx.$executeRaw`INSERT INTO public."User" (id, name, email, "passwordHash", "locationId", "lastActivityAt", "updatedAt") VALUES
        (1, 'test', '1@test', 'unused', 1, timezone('UTC', now()), now()),
        (2, 'test', '2@test', 'unused', 2, timezone('UTC', now()) - interval '7 days', now()),
        (3, 'test', '3@test', 'unused', 3, NULL, now()),
        (4, 'test', '4@test', 'unused', 4, timezone('UTC', now()) + interval '1 hour', now()),
        (5, 'test', '5@test', 'unused', 5, timezone('UTC', now()) - interval '6 days', now()),
        (6, 'test', '6@test', 'unused', NULL, NULL, now()),
        (7, 'test', '7@test', 'unused', NULL, NULL, now())`;
            await tx.$executeRaw`INSERT INTO public."Group" (id, name, image, "invitationCode", "shareLocationMandatorily", "updatedAt", "deletedAt") VALUES
        (1, 'test', '', '1', false, now(), NULL),
        (2, 'test', '', '2', true, now(), NULL),
        (3, 'test', '', '3', true, now(), now()),
        (4, 'test', '', '4', false, now(), NULL)`;
            await tx.$executeRaw`INSERT INTO public."Member" ("userId", "groupId", role, "locationSharingEnabled") VALUES
        (1, 1, 'ADMIN', true), (1, 2, 'ADMIN', false), (1, 3, 'ADMIN', true),
        (2, 1, 'MEMBER', true), (3, 1, 'MEMBER', true), (4, 1, 'MEMBER', true),
        (5, 1, 'MEMBER', true), (6, 3, 'MEMBER', true), (7, 1, 'MEMBER', true)`;
            await tx.$executeRaw`INSERT INTO public."PointOfInterest" (name, radius, "locationId", "groupId", validity, "endTime", "deletedAt", "updatedAt") VALUES
        ('test', 1, 1, 1, 'PERMANENT', NULL, NULL, now()),
        ('test', 1, 2, 2, 'ONE_DAY', timezone('UTC', now()), NULL, now()),
        ('test', 1, 3, 2, 'PERMANENT', NULL, now(), now()),
        ('test', 1, 4, 3, 'PERMANENT', NULL, NULL, now()),
        ('test', 1, 5, 2, 'ONE_DAY', NULL, NULL, now())`;
            await tx.$executeRaw`INSERT INTO public."Event" (name, "startAt", "groupId", "deletedAt", "updatedAt") VALUES
        ('test', now() - interval '1 year', 1, NULL, now()),
        ('test', now(), 1, NULL, now()), ('test', now(), 2, now(), now()),
        ('test', now(), 3, NULL, now())`;
            const rows = await tx.$queryRaw<
              Record<string, bigint | number>[]
            >`SELECT * FROM bond_metrics.sprint6`;
            const row = Object.fromEntries(
              Object.entries(rows[0]).map(([key, value]) => [
                key,
                Number(value),
              ]),
            );
            expect(row.users_with_recent_location_percent).toBeCloseTo(100 / 6);
            expect(row.groups_with_poi_percent).toBeCloseTo(100 / 3);
            expect(row.groups_with_events_percent).toBeCloseTo(100 / 3);
            expect(row).toEqual({
              total_users: 7,
              users_sharing_location: 6,
              users_with_recent_location: 1,
              users_with_recent_location_percent:
                row.users_with_recent_location_percent,
              weekly_active_users_foreground: 2,
              active_groups: 3,
              groups_with_two_or_more_members: 1,
              groups_with_poi: 1,
              groups_with_poi_percent: row.groups_with_poi_percent,
              groups_with_events: 1,
              groups_with_events_percent: row.groups_with_events_percent,
            });
            await tx.$executeRaw`UPDATE public."Member" SET "locationSharingEnabled" = false WHERE "userId" = 1`;
            const mandatory = await tx.$queryRaw<
              { n: bigint }[]
            >`SELECT users_with_recent_location AS n FROM bond_metrics.sprint6`;
            expect(mandatory[0].n).toBe(1n);
            await tx.$executeRaw`UPDATE public."Group" SET "shareLocationMandatorily" = false WHERE id = 2`;
            const optedOut = await tx.$queryRaw<
              { n: bigint }[]
            >`SELECT users_with_recent_location AS n FROM bond_metrics.sprint6`;
            expect(optedOut[0].n).toBe(0n);
            await tx.$executeRaw`UPDATE public."PointOfInterest" SET "endTime" = timezone('UTC', now()) + interval '1 hour' WHERE "locationId" = 2`;
            const futurePoi = await tx.$queryRaw<
              { n: bigint }[]
            >`SELECT groups_with_poi AS n FROM bond_metrics.sprint6`;
            expect(futurePoi[0].n).toBe(2n);
            await tx.$executeRaw`UPDATE public."Member" SET "locationSharingEnabled" = false`;
            const none = await tx.$queryRaw<
              {
                users_sharing_location: bigint;
                users_with_recent_location_percent: number;
              }[]
            >`SELECT users_sharing_location, users_with_recent_location_percent FROM bond_metrics.sprint6`;
            expect(none[0].users_sharing_location).toBe(0n);
            expect(Number(none[0].users_with_recent_location_percent)).toBe(0);
            throw new Error('ROLLBACK_FIXTURES');
          },
          { maxWait: 10000, timeout: 20000 },
        )
        .catch((error: unknown) => {
          if (
            !(error instanceof Error) ||
            error.message !== 'ROLLBACK_FIXTURES'
          )
            throw error;
        });
    });

    it('allows an aggregate-only reader to read the view but not personal tables', async () => {
      await expect(
        prisma.$transaction(async (tx) => {
          await tx.$executeRaw`CREATE ROLE bond_metrics_s6_test_reader NOLOGIN`;
          await tx.$executeRaw`GRANT USAGE ON SCHEMA bond_metrics TO bond_metrics_s6_test_reader`;
          await tx.$executeRaw`GRANT SELECT ON bond_metrics.sprint6 TO bond_metrics_s6_test_reader`;
          await tx.$executeRaw`SET LOCAL ROLE bond_metrics_s6_test_reader`;
          expect(
            await tx.$queryRaw`SELECT * FROM bond_metrics.sprint6`,
          ).toHaveLength(1);
          const privileges = await tx.$queryRaw<
            { source: boolean; write: boolean }[]
          >`
        SELECT has_table_privilege(current_user, 'public."User"', 'SELECT') AS source,
          has_table_privilege(current_user, 'bond_metrics.sprint6', 'UPDATE') AS write`;
          expect(privileges).toEqual([{ source: false, write: false }]);
          await tx.$queryRaw`SELECT * FROM public."User"`;
        }),
      ).rejects.toThrow(/42501/);
      // The denied query rolls back role creation and grants as well as the transaction.
    });
    it('throttles repeated/concurrent activity writes, leaves updatedAt untouched, and deletes activity with the user', async () => {
      const user = await prisma.user.create({
        data: { name: 'test', email: 'activity@test', passwordHash: 'unused' },
      });
      try {
        const repository = new ActivityPrismaRepository(prisma);
        await repository.record(user.id);
        const first = await prisma.user.findUniqueOrThrow({
          where: { id: user.id },
        });
        expect(first.lastActivityAt).not.toBeNull();
        await Promise.all([
          repository.record(user.id),
          repository.record(user.id),
        ]);
        expect(
          await prisma.user.findUniqueOrThrow({ where: { id: user.id } }),
        ).toEqual(first);
        expect(first.updatedAt).toEqual(user.updatedAt);
        await prisma.$executeRaw`UPDATE public."User" SET "lastActivityAt" = timezone('UTC', now()) - interval '6 minutes' WHERE id = ${user.id}`;
        await repository.record(user.id);
        const refreshed = await prisma.user.findUniqueOrThrow({
          where: { id: user.id },
        });
        expect(refreshed.lastActivityAt!.getTime()).toBeGreaterThanOrEqual(
          first.lastActivityAt!.getTime(),
        );
      } finally {
        await prisma.user.delete({ where: { id: user.id } });
      }
      await new ActivityPrismaRepository(prisma).record(user.id);
      expect(
        await prisma.user.findUnique({ where: { id: user.id } }),
      ).toBeNull();
    });
  },
);
