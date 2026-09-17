import { INestApplication } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { WsAdapter } from '@nestjs/platform-ws';
import { Test } from '@nestjs/testing';
import { RoleEnum } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { createHash, randomUUID } from 'crypto';
import request from 'supertest';
import { App } from 'supertest/types';
import { WebSocket } from 'ws';
import { LocationModule } from '../src/location/location.module';
import { MailService } from '../src/mail/mail.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { PrismaModule } from '../src/prisma/prisma.module';
import { UserModule } from '../src/user/user.module';

const databaseUrl = process.env.DATABASE_URL;
const runDatabaseTests = process.env.RUN_DB_TESTS === '1';

describe('DELETE /user/me (PostgreSQL)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const sendVerification = jest
    .fn<Promise<void>, [string, string, string]>()
    .mockResolvedValue(undefined);
  const password = 'clave123456';
  let passwordHash: string;

  beforeAll(async () => {
    if (!runDatabaseTests) return;
    if (!databaseUrl || !new URL(databaseUrl).pathname.endsWith('_test')) {
      throw new Error(
        'Las pruebas de borrado requieren una base terminada en _test.',
      );
    }
    passwordHash = await bcrypt.hash(password, 4);
    process.env.API_BASE_URL ??= 'http://localhost:3000';
    const module = await Test.createTestingModule({
      imports: [
        EventEmitterModule.forRoot(),
        PrismaModule,
        UserModule,
        LocationModule,
      ],
    })
      .overrideProvider(MailService)
      .useValue({ sendEmailVerification: sendVerification })
      .compile();
    app = module.createNestApplication({ logger: false });
    app.useWebSocketAdapter(new WsAdapter(app));
    await app.listen(0, '127.0.0.1');
    prisma = module.get(PrismaService);
  });

  async function clearDatabase(): Promise<void> {
    await prisma.event.deleteMany();
    await prisma.reminder.deleteMany();
    await prisma.pointOfInterest.deleteMany();
    await prisma.member.deleteMany();
    await prisma.group.deleteMany();
    await prisma.user.deleteMany();
    await prisma.location.deleteMany();
  }

  beforeEach(async () => {
    if (runDatabaseTests) {
      await clearDatabase();
      sendVerification.mockClear();
    }
  });
  afterAll(async () => {
    if (runDatabaseTests && app) {
      await clearDatabase();
      await app.close();
    }
  });

  async function createUser(name: string) {
    return prisma.user.create({
      data: {
        name,
        email: `${name}-${randomUUID()}@bond.test`,
        passwordHash,
        emailVerifiedAt: new Date(),
      },
    });
  }

  async function createSession(userId: number): Promise<string> {
    const token = randomUUID();
    await prisma.userSession.create({
      data: {
        userId,
        tokenHash: createHash('sha256').update(token).digest('hex'),
        expiresAt: new Date(Date.now() + 86400000),
      },
    });
    return token;
  }

  async function createGroup(name: string) {
    return prisma.group.create({
      data: { name, invitationCode: randomUUID() },
    });
  }

  const testDb = runDatabaseTests ? it : it.skip;

  testDb(
    'borra solo la cuenta autenticada y todas sus dependencias, conservando grupos compartidos',
    async () => {
      const target = await createUser('target');
      const peer = await createUser('peer');
      const secondPeer = await createUser('second');
      const outsider = await createUser('outsider');
      const personal = await prisma.location.create({
        data: { latitude: 1, longitude: 2 },
      });
      await prisma.user.update({
        where: { id: target.id },
        data: { locationId: personal.id },
      });
      const token = await createSession(target.id);
      await createSession(target.id);
      await prisma.emailVerificationToken.create({
        data: {
          userId: target.id,
          tokenHash: randomUUID(),
          expiresAt: new Date(Date.now() + 86400000),
        },
      });
      await prisma.devicePushToken.create({
        data: {
          userId: target.id,
          token: randomUUID(),
          platform: 'android',
        },
      });

      const memberGroup = await createGroup('member');
      const member = await prisma.member.create({
        data: {
          userId: target.id,
          groupId: memberGroup.id,
          role: RoleEnum.MEMBER,
        },
      });
      await prisma.member.create({
        data: {
          userId: peer.id,
          groupId: memberGroup.id,
          role: RoleEnum.ADMIN,
        },
      });
      const sharedEvent = await prisma.event.create({
        data: {
          groupId: memberGroup.id,
          name: 'shared',
          startAt: new Date(),
        },
      });
      await prisma.eventMember.create({
        data: { eventId: sharedEvent.id, memberId: member.id },
      });
      await prisma.memberNotificationPreference.create({
        data: {
          memberId: member.id,
          type: 'POINT_OF_INTEREST_CREATED',
        },
      });
      const sharedLocation = await prisma.location.create({
        data: { latitude: 3, longitude: 4 },
      });
      const sharedPoint = await prisma.pointOfInterest.create({
        data: {
          groupId: memberGroup.id,
          locationId: sharedLocation.id,
          name: 'shared poi',
          radius: 10,
        },
      });
      await prisma.pointOfInterestPresence.create({
        data: {
          memberId: member.id,
          pointOfInterestId: sharedPoint.id,
          isInside: true,
        },
      });

      const twoAdmins = await createGroup('two admins');
      await prisma.member.create({
        data: {
          userId: target.id,
          groupId: twoAdmins.id,
          role: RoleEnum.ADMIN,
        },
      });
      const existingAdmin = await prisma.member.create({
        data: {
          userId: peer.id,
          groupId: twoAdmins.id,
          role: RoleEnum.ADMIN,
        },
      });

      const soleAdmin = await createGroup('sole admin');
      await prisma.member.create({
        data: {
          userId: target.id,
          groupId: soleAdmin.id,
          role: RoleEnum.ADMIN,
        },
      });
      const firstRemaining = await prisma.member.create({
        data: {
          userId: peer.id,
          groupId: soleAdmin.id,
          role: RoleEnum.MEMBER,
        },
      });
      const laterRemaining = await prisma.member.create({
        data: {
          userId: secondPeer.id,
          groupId: soleAdmin.id,
          role: RoleEnum.MEMBER,
        },
      });

      const solo = await createGroup('solo');
      const soloMember = await prisma.member.create({
        data: {
          userId: target.id,
          groupId: solo.id,
          role: RoleEnum.ADMIN,
        },
      });
      const eventLocation = await prisma.location.create({
        data: { latitude: 5, longitude: 6 },
      });
      const pointLocation = await prisma.location.create({
        data: { latitude: 7, longitude: 8 },
      });
      const soloEvent = await prisma.event.create({
        data: {
          groupId: solo.id,
          name: 'solo event',
          startAt: new Date(),
          locationId: eventLocation.id,
        },
      });
      await prisma.eventMember.create({
        data: { eventId: soloEvent.id, memberId: soloMember.id },
      });
      await prisma.reminder.create({
        data: {
          groupId: solo.id,
          description: 'solo reminder',
          dueDate: new Date(),
        },
      });
      const soloPoint = await prisma.pointOfInterest.create({
        data: {
          groupId: solo.id,
          locationId: pointLocation.id,
          name: 'solo poi',
          radius: 10,
        },
      });
      await prisma.pointOfInterestPresence.create({
        data: {
          memberId: soloMember.id,
          pointOfInterestId: soloPoint.id,
          isInside: true,
        },
      });
      await prisma.memberNotificationPreference.create({
        data: {
          memberId: soloMember.id,
          type: 'POINT_OF_INTEREST_UPDATED',
        },
      });

      const unrelated = await createGroup('unrelated');
      await prisma.member.create({
        data: {
          userId: outsider.id,
          groupId: unrelated.id,
          role: RoleEnum.ADMIN,
        },
      });

      await request(app.getHttpServer())
        .get('/user/me')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      await request(app.getHttpServer()).delete('/user/me').expect(401);
      await request(app.getHttpServer())
        .delete(`/user/${peer.id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(404);
      await request(app.getHttpServer())
        .delete('/user/me')
        .set('Authorization', `Bearer ${token}`)
        .expect(204);

      expect(
        await prisma.user.findUnique({ where: { id: target.id } }),
      ).toBeNull();
      expect(await prisma.member.count({ where: { userId: target.id } })).toBe(
        0,
      );
      expect(
        await prisma.userSession.count({ where: { userId: target.id } }),
      ).toBe(0);
      expect(
        await prisma.emailVerificationToken.count({
          where: { userId: target.id },
        }),
      ).toBe(0);
      expect(
        await prisma.devicePushToken.count({ where: { userId: target.id } }),
      ).toBe(0);
      expect(
        await prisma.location.count({
          where: {
            id: { in: [personal.id, eventLocation.id, pointLocation.id] },
          },
        }),
      ).toBe(0);
      expect(
        await prisma.group.findUnique({ where: { id: solo.id } }),
      ).toBeNull();
      expect(await prisma.event.count({ where: { groupId: solo.id } })).toBe(0);
      expect(await prisma.reminder.count({ where: { groupId: solo.id } })).toBe(
        0,
      );
      expect(
        await prisma.pointOfInterest.count({ where: { groupId: solo.id } }),
      ).toBe(0);
      expect(
        await prisma.eventMember.count({
          where: { memberId: { in: [member.id, soloMember.id] } },
        }),
      ).toBe(0);
      expect(
        await prisma.memberNotificationPreference.count({
          where: { memberId: { in: [member.id, soloMember.id] } },
        }),
      ).toBe(0);
      expect(
        await prisma.pointOfInterestPresence.count({
          where: { memberId: { in: [member.id, soloMember.id] } },
        }),
      ).toBe(0);
      expect(
        await prisma.member.findUnique({ where: { id: firstRemaining.id } }),
      ).toMatchObject({ role: RoleEnum.ADMIN });
      expect(
        await prisma.member.findUnique({ where: { id: laterRemaining.id } }),
      ).toMatchObject({ role: RoleEnum.MEMBER });
      expect(
        await prisma.member.findUnique({ where: { id: existingAdmin.id } }),
      ).toMatchObject({ role: RoleEnum.ADMIN });
      expect(
        await prisma.group.findUnique({ where: { id: memberGroup.id } }),
      ).not.toBeNull();
      expect(
        await prisma.event.findUnique({ where: { id: sharedEvent.id } }),
      ).not.toBeNull();
      expect(
        await prisma.pointOfInterest.findUnique({
          where: { id: sharedPoint.id },
        }),
      ).not.toBeNull();
      expect(
        await prisma.location.findUnique({ where: { id: sharedLocation.id } }),
      ).not.toBeNull();
      expect(
        await prisma.group.findUnique({ where: { id: unrelated.id } }),
      ).not.toBeNull();
      expect(
        await prisma.user.findUnique({ where: { id: peer.id } }),
      ).not.toBeNull();
      await request(app.getHttpServer())
        .get('/user/me')
        .set('Authorization', `Bearer ${token}`)
        .expect(401);
      await request(app.getHttpServer())
        .post('/user/login')
        .send({ email: target.email, password })
        .expect(401);
    },
  );

  testDb(
    'revierte promociones y borrados si falla el DELETE de User',
    async () => {
      const target = await createUser('rollback-target');
      const peer = await createUser('rollback-peer');
      const group = await createGroup('rollback');
      const targetMember = await prisma.member.create({
        data: {
          userId: target.id,
          groupId: group.id,
          role: RoleEnum.ADMIN,
        },
      });
      const peerMember = await prisma.member.create({
        data: {
          userId: peer.id,
          groupId: group.id,
          role: RoleEnum.MEMBER,
        },
      });
      const token = await createSession(target.id);
      await prisma.$executeRawUnsafe(`CREATE FUNCTION reject_account_deletion() RETURNS trigger AS $$
      BEGIN RAISE EXCEPTION 'forced rollback'; END; $$ LANGUAGE plpgsql`);
      await prisma.$executeRawUnsafe(`CREATE TRIGGER reject_account_deletion
      BEFORE DELETE ON "User" FOR EACH ROW EXECUTE FUNCTION reject_account_deletion()`);
      try {
        await request(app.getHttpServer())
          .delete('/user/me')
          .set('Authorization', `Bearer ${token}`)
          .expect(500);
        expect(
          await prisma.user.findUnique({ where: { id: target.id } }),
        ).not.toBeNull();
        expect(
          await prisma.member.findUnique({ where: { id: targetMember.id } }),
        ).not.toBeNull();
        expect(
          await prisma.member.findUnique({ where: { id: peerMember.id } }),
        ).toMatchObject({ role: RoleEnum.MEMBER });
        expect(
          await prisma.userSession.count({ where: { userId: target.id } }),
        ).toBe(1);
        await request(app.getHttpServer())
          .get('/user/me')
          .set('Authorization', `Bearer ${token}`)
          .expect(200);
      } finally {
        await prisma.$executeRawUnsafe(
          'DROP TRIGGER reject_account_deletion ON "User"',
        );
        await prisma.$executeRawUnsafe(
          'DROP FUNCTION reject_account_deletion()',
        );
      }
    },
  );

  testDb('desconecta el WebSocket autenticado despues del commit', async () => {
    const target = await createUser('socket-target');
    const token = await createSession(target.id);
    const socketUrl = new URL('/location/ws', await app.getUrl());
    socketUrl.protocol = 'ws:';
    const socket = new WebSocket(socketUrl);
    try {
      await new Promise<void>((resolve, reject) => {
        socket.once('open', () => resolve());
        socket.once('error', reject);
      });
      const authenticated = new Promise<void>((resolve) => {
        socket.on('message', (raw) => {
          if (!Buffer.isBuffer(raw)) return;
          const message = JSON.parse(raw.toString()) as { event: string };
          if (message.event === 'authenticated') resolve();
        });
      });
      socket.send(
        JSON.stringify({
          event: 'authenticate',
          data: { sessionToken: token },
        }),
      );
      await authenticated;
      const closed = new Promise<number>((resolve) => {
        socket.once('close', (code) => resolve(code));
      });
      await request(app.getHttpServer())
        .delete('/user/me')
        .set('Authorization', `Bearer ${token}`)
        .expect(204);
      expect(await closed).toBe(1008);
      expect(
        await prisma.user.findUnique({ where: { id: target.id } }),
      ).toBeNull();
    } finally {
      socket.terminate();
    }
  });

  testDb(
    'conserva login, perfil, restauracion y logout de cuentas existentes',
    async () => {
      const user = await createUser('active-login');
      const login = await request(app.getHttpServer())
        .post('/user/login')
        .send({ email: user.email, password })
        .expect(200);
      const loginBody = login.body as { sessionToken: string };
      const token = loginBody.sessionToken;
      expect(token).toBeTruthy();
      await request(app.getHttpServer())
        .get('/user/me')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      await request(app.getHttpServer())
        .get('/user/profile')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      await request(app.getHttpServer())
        .post('/user/logout')
        .set('Authorization', `Bearer ${token}`)
        .expect(204);
      await request(app.getHttpServer())
        .get('/user/me')
        .set('Authorization', `Bearer ${token}`)
        .expect(401);
    },
  );

  testDb(
    'conserva registro, reenvio, verificacion y unicidad de email',
    async () => {
      const email = `registro-${randomUUID()}@bond.test`;
      await request(app.getHttpServer())
        .post('/user')
        .send({ name: 'Registro', email, password })
        .expect(201);
      const user = await prisma.user.findUniqueOrThrow({ where: { email } });
      expect(user.passwordHash).not.toBe(password);
      expect(user.emailVerifiedAt).toBeNull();
      expect(sendVerification).toHaveBeenCalledTimes(1);
      await request(app.getHttpServer())
        .post('/user/resend-verification-email')
        .send({ email })
        .expect(200);
      expect(sendVerification).toHaveBeenCalledTimes(2);
      const verificationUrl = sendVerification.mock.calls[1][2];
      const token = new URL(verificationUrl).searchParams.get('token');
      expect(token).toBeTruthy();
      await request(app.getHttpServer())
        .get('/user/verify-email')
        .query({ token })
        .expect(200);
      expect(
        (await prisma.user.findUniqueOrThrow({ where: { email } }))
          .emailVerifiedAt,
      ).not.toBeNull();
      await request(app.getHttpServer())
        .post('/user/login')
        .send({ email, password })
        .expect(200);
      await request(app.getHttpServer())
        .post('/user')
        .send({ name: 'Duplicado', email, password })
        .expect(409);
    },
  );
});
