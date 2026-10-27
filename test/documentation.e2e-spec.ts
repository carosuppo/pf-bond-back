import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { Client } from 'pg';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import request from 'supertest';
import { App } from 'supertest/types';
import { PrismaService } from '../src/prisma/prisma.service';
import { DocumentController } from '../src/document/document.controller';
import { DocumentListingDto } from '../src/document/document.dto';
import { DocumentService } from '../src/document/document.service';
import { DocumentStorageService } from '../src/document/document-storage.service';
import { DocumentPrismaRepository } from '../src/document/document.prisma.repository';
import { SessionAuthGuard } from '../src/user/guard/session-auth.guard';
import { SessionAuthenticationService } from '../src/user/service/session-authentication.service';
import { UserSessionPrismaRepository } from '../src/user/repository/user-session.prisma.repository';
import { createHash } from 'node:crypto';

const enabled = process.env.RUN_DOCUMENT_DB_TESTS === '1';
const suite = enabled ? describe : describe.skip;
const pdf = Buffer.from('%PDF-1.4\n%%EOF');

suite('Documentation HTTP + isolated PostgreSQL (Storage fake)', () => {
  let app: INestApplication<App>;
  let db: PrismaService;
  let service: DocumentService;
  let sql: Client;
  const objects = new Map<string, Buffer>();
  let failUpload = false;
  let failRemove = false;
  let failDownload = false;
  const base = '/group/1/documentation';
  const http = () => request(app.getHttpServer());
  const auth = 'Bearer session-one';
  const storage = {
    upload: jest.fn((path: string, bytes: Buffer) => {
      if (failUpload)
        return Promise.reject(new Error('Storage upload unavailable'));
      objects.set(path, bytes);
      return Promise.resolve();
    }),
    download: jest.fn((path: string) => {
      if (failDownload || !objects.has(path))
        return Promise.reject(new Error('Storage download unavailable'));
      return Promise.resolve(objects.get(path)!);
    }),
    remove: jest.fn((path: string) => {
      if (failRemove)
        return Promise.reject(new Error('Storage remove unavailable'));
      objects.delete(path);
      return Promise.resolve();
    }),
  };

  beforeAll(async () => {
    const url = new URL(process.env.DATABASE_URL!);
    if (
      url.hostname !== '127.0.0.1' ||
      url.port !== '55439' ||
      url.pathname !== '/documentation_test'
    )
      throw new Error(
        'Only isolated 127.0.0.1:55439/documentation_test is allowed.',
      );
    sql = new Client({ connectionString: url.toString() });
    await sql.connect();
    // Minimal fixtures for existing models. No migrate deploy/db push is executed.
    await sql.query(`
      CREATE TYPE "RoleEnum" AS ENUM ('ADMIN', 'MEMBER');
      CREATE TABLE "User" ("id" SERIAL PRIMARY KEY, "name" TEXT NOT NULL, "email" TEXT NOT NULL UNIQUE, "passwordHash" TEXT NOT NULL DEFAULT '', "profilePhoto" TEXT, "profilePhotoPath" TEXT, "locationId" INT, "notificationsEnabled" BOOLEAN NOT NULL DEFAULT true, "emailVerifiedAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now());
      CREATE TABLE "Group" ("id" SERIAL PRIMARY KEY, "name" TEXT NOT NULL, "image" TEXT NOT NULL DEFAULT '', "description" TEXT, "shareLocationMandatorily" BOOLEAN DEFAULT false, "invitationCode" TEXT UNIQUE, "createdAt" TIMESTAMP DEFAULT now(), "updatedAt" TIMESTAMP DEFAULT now(), "deletedAt" TIMESTAMP);
      CREATE TABLE "Member" ("id" SERIAL PRIMARY KEY, "userId" INT REFERENCES "User", "groupId" INT REFERENCES "Group" ON DELETE CASCADE, "role" "RoleEnum" DEFAULT 'MEMBER', "notificationsEnabled" BOOLEAN DEFAULT true, "locationSharingEnabled" BOOLEAN DEFAULT false, UNIQUE("userId", "groupId"));
      CREATE TABLE "UserSession" ("id" SERIAL PRIMARY KEY, "userId" INT REFERENCES "User" ON DELETE CASCADE, "tokenHash" TEXT UNIQUE, "expiresAt" TIMESTAMP, "revokedAt" TIMESTAMP, "createdAt" TIMESTAMP DEFAULT now(), "updatedAt" TIMESTAMP DEFAULT now());
    `);
    await sql.query(
      readFileSync(
        join(
          __dirname,
          '../prisma/migrations/20261026000000_family_documentation/migration.sql',
        ),
        'utf8',
      ),
    );
    await sql.query(
      readFileSync(
        join(
          __dirname,
          '../prisma/migrations/20261027000000_optional_document_member/migration.sql',
        ),
        'utf8',
      ),
    );
    const module = await Test.createTestingModule({
      controllers: [DocumentController],
      providers: [
        PrismaService,
        DocumentService,
        SessionAuthGuard,
        SessionAuthenticationService,
        {
          provide: 'userSessionRepository',
          useClass: UserSessionPrismaRepository,
        },
        { provide: 'documentRepository', useClass: DocumentPrismaRepository },
        { provide: DocumentStorageService, useValue: storage },
        { provide: ConfigService, useValue: new ConfigService() },
      ],
    }).compile();
    app = module.createNestApplication({ logger: false });
    app.useGlobalPipes(
      new ValidationPipe({ transform: true, whitelist: true }),
    );
    await app.init();
    db = module.get(PrismaService);
    service = module.get(DocumentService);
  }, 30000);

  beforeEach(async () => {
    await sql.query(
      'TRUNCATE "UserSession", "FamilyDocument", "DocumentFolder", "DocumentObject", "Member", "Group", "User" RESTART IDENTITY CASCADE',
    );
    await sql.query(
      `INSERT INTO "User" ("id", "name", "email") VALUES (1, 'Ana', 'ana@test.local'), (2, 'Luis', 'luis@test.local'), (3, 'Otro', 'otro@test.local'); INSERT INTO "Group" ("id", "name") VALUES (1, 'Familia'), (2, 'Otro grupo'); INSERT INTO "Member" ("id", "userId", "groupId") VALUES (1, 1, 1), (2, 2, 1), (3, 3, 2);`,
    );
    await db.userSession.create({
      data: {
        userId: 1,
        tokenHash: createHash('sha256').update('session-one').digest('hex'),
        expiresAt: new Date(Date.now() + 3600000),
      },
    });
    objects.clear();
    failUpload = false;
    failRemove = false;
    failDownload = false;
    jest.clearAllMocks();
  });
  afterAll(async () => {
    if (app) await app.close();
    if (sql) {
      await sql.query(
        'DROP TABLE IF EXISTS "UserSession", "FamilyDocument", "DocumentFolder", "DocumentObject", "Member", "Group", "User" CASCADE; DROP FUNCTION IF EXISTS check_document_member(), check_document_folder(), retire_document_object(); DROP TYPE IF EXISTS "RoleEnum"',
      );
      await sql.end();
    }
  });

  async function upload(folderId?: string, memberId = 2) {
    let req = http()
      .post(`${base}/documents`)
      .set('Authorization', auth)
      .field('name', 'Documento')
      .field('memberId', memberId);
    if (folderId) req = req.field('folderId', folderId);
    const response = await req
      .attach('file', pdf, {
        filename: 'file.pdf',
        contentType: 'application/pdf',
      })
      .expect(201);
    return response.body as {
      id: string;
      memberId: number;
      folderId: string | null;
      version: number;
    };
  }
  async function folder(name: string, parentId?: string) {
    const response = await http()
      .post(`${base}/folders`)
      .set('Authorization', auth)
      .send({ name, parentId })
      .expect(201);
    return response.body as { id: string };
  }

  it('lists root, nested folders, recursive member filter and serves private PDF', async () => {
    const parent = await folder('Salud');
    const child = await folder('Estudios', parent.id);
    const rootDoc = await upload();
    const nested = await upload(child.id);
    const root = await http().get(base).set('Authorization', auth).expect(200);
    expect(
      (root.body as DocumentListingDto).documents.map((d) => d.id),
    ).toEqual([rootDoc.id]);
    expect((root.body as DocumentListingDto).documents[0]).not.toHaveProperty(
      'objectPath',
    );
    const filtered = await http()
      .get(`${base}?memberId=2`)
      .set('Authorization', auth)
      .expect(200);
    expect((filtered.body as DocumentListingDto).documents).toHaveLength(2);
    const content = await http()
      .get(`${base}/documents/${nested.id}/content`)
      .set('Authorization', auth)
      .expect(200);
    expect(content.headers['cache-control']).toContain('no-store');
    expect(content.headers['content-type']).toContain('application/pdf');
  });
  it('allows no member, assigning later, preserving on replacement and removing association', async () => {
    const created = await http()
      .post(`${base}/documents`)
      .set('Authorization', auth)
      .field('name', 'Documento del grupo')
      .attach('file', pdf, {
        filename: 'file.pdf',
        contentType: 'application/pdf',
      })
      .expect(201);
    const doc = created.body as {
      id: string;
      memberId: number | null;
      memberName: string | null;
    };
    expect(doc.memberId).toBeNull();
    expect(doc.memberName).toBeNull();
    const listing = await http()
      .get(base)
      .set('Authorization', auth)
      .expect(200);
    expect((listing.body as DocumentListingDto).documents).toHaveLength(1);
    const filtered = await http()
      .get(`${base}?memberId=2`)
      .set('Authorization', auth)
      .expect(200);
    expect((filtered.body as DocumentListingDto).documents).toHaveLength(0);
    await http()
      .get(`${base}/documents/${doc.id}/content`)
      .set('Authorization', auth)
      .expect(200);
    await http()
      .patch(`${base}/documents/${doc.id}`)
      .set('Authorization', auth)
      .field('memberId', '0')
      .expect(400);
    await http()
      .patch(`${base}/documents/${doc.id}`)
      .set('Authorization', auth)
      .field('memberId', '3')
      .expect(400);
    await http()
      .patch(`${base}/documents/${doc.id}`)
      .set('Authorization', auth)
      .field('memberId', '2')
      .expect(200);
    await http()
      .patch(`${base}/documents/${doc.id}`)
      .set('Authorization', auth)
      .attach('file', pdf, {
        filename: 'new.pdf',
        contentType: 'application/pdf',
      })
      .expect(200);
    expect(
      (await db.familyDocument.findUniqueOrThrow({ where: { id: doc.id } }))
        .memberId,
    ).toBe(2);
    await http()
      .patch(`${base}/documents/${doc.id}`)
      .set('Authorization', auth)
      .field('memberId', '')
      .expect(200);
    expect(
      await db.familyDocument.findUniqueOrThrow({ where: { id: doc.id } }),
    ).toMatchObject({ memberId: null, memberName: null });
    await http()
      .patch(`${base}/documents/${doc.id}`)
      .set('Authorization', auth)
      .send({ memberId: 1 })
      .expect(200);
    await http()
      .patch(`${base}/documents/${doc.id}`)
      .set('Authorization', auth)
      .send({ memberId: null })
      .expect(200);
    await expect(
      db.familyDocument.update({
        where: { id: doc.id },
        data: { memberId: 3, memberName: 'Otro' },
      }),
    ).rejects.toThrow();
    await http()
      .delete(`${base}/documents/${doc.id}`)
      .set('Authorization', auth)
      .expect(204);
  });
  it('edits, moves, renames and replaces with one stable identity', async () => {
    const destination = await folder('Antes');
    const original = await upload();
    const old = await db.familyDocument.findUniqueOrThrow({
      where: { id: original.id },
    });
    await http()
      .patch(`${base}/folders/${destination.id}`)
      .set('Authorization', auth)
      .send({ name: 'Después' })
      .expect(200);
    await http()
      .patch(`${base}/documents/${original.id}`)
      .set('Authorization', auth)
      .field('name', 'Actualizado')
      .field('memberId', '1')
      .field('folderId', destination.id)
      .expect(200);
    await http()
      .patch(`${base}/documents/${original.id}`)
      .set('Authorization', auth)
      .attach('file', Buffer.from('%PDF-1.7\n%%EOF'), {
        filename: 'new.pdf',
        contentType: 'application/pdf',
      })
      .expect(200);
    const updated = await db.familyDocument.findUniqueOrThrow({
      where: { id: original.id },
    });
    expect(updated).toMatchObject({
      name: 'Actualizado',
      folderId: destination.id,
      memberId: 1,
    });
    expect(updated.objectPath).not.toBe(old.objectPath);
    expect(await db.familyDocument.count()).toBe(1);
    expect(
      (
        await db.documentObject.findUniqueOrThrow({
          where: { path: old.objectPath },
        })
      ).state,
    ).toBe('retired');
    await http()
      .get(`${base}/documents/${encodeURIComponent(old.objectPath)}/content`)
      .set('Authorization', auth)
      .expect(400);
    await http()
      .patch(`${base}/documents/${original.id}`)
      .set('Authorization', auth)
      .field('folderId', '')
      .expect(200);
    expect(
      (
        await db.familyDocument.findUniqueOrThrow({
          where: { id: original.id },
        })
      ).folderId,
    ).toBeNull();
  });
  it('rejects spoofed MIME, oversized files, empty names and absent file', async () => {
    await http()
      .post(`${base}/documents`)
      .set('Authorization', auth)
      .field('name', 'File')
      .field('memberId', '1')
      .attach('file', pdf, { filename: 'fake.png', contentType: 'image/png' })
      .expect(400);
    await http()
      .post(`${base}/documents`)
      .set('Authorization', auth)
      .field('name', 'File')
      .field('memberId', '1')
      .attach('file', Buffer.alloc(10485761), {
        filename: 'big.pdf',
        contentType: 'application/pdf',
      })
      .expect(413);
    await http()
      .post(`${base}/documents`)
      .set('Authorization', auth)
      .send({ name: '', memberId: 1 })
      .expect(400);
    await http()
      .post(`${base}/documents`)
      .set('Authorization', auth)
      .send({ name: 'Missing' })
      .expect(400);
    await http()
      .post(`${base}/documents`)
      .set('Authorization', auth)
      .send({ name: 'Missing', memberId: 1 })
      .expect(400);
    expect(await db.familyDocument.count()).toBe(0);
  });
  it('requires live session and membership for reads and mutations, including downloads after leaving', async () => {
    const doc = await upload();
    await http().get(base).expect(401);
    await http()
      .get('/group/2/documentation')
      .set('Authorization', auth)
      .expect(403);
    await db.member.delete({ where: { id: 1 } });
    for (const path of [base, `${base}/documents/${doc.id}/content`])
      await http().get(path).set('Authorization', auth).expect(403);
    await http()
      .delete(`${base}/documents/${doc.id}`)
      .set('Authorization', auth)
      .expect(403);
    await http()
      .post(`${base}/folders`)
      .set('Authorization', auth)
      .send({ name: 'No' })
      .expect(403);
    await db.userSession.updateMany({ data: { revokedAt: new Date() } });
    await http().get(base).set('Authorization', auth).expect(401);
  });
  it('rejects foreign member and foreign folder in API and database', async () => {
    const foreign = await db.documentFolder.create({
      data: { groupId: 2, name: 'Private' },
    });
    const doc = await upload();
    await db.member.create({
      data: { id: 4, userId: 1, groupId: 2, role: 'MEMBER' },
    });
    await http()
      .get(`/group/2/documentation/documents/${doc.id}/content`)
      .set('Authorization', auth)
      .expect(404);
    await http()
      .delete(`/group/2/documentation/documents/${doc.id}`)
      .set('Authorization', auth)
      .expect(404);
    await http()
      .patch(`${base}/documents/${doc.id}`)
      .set('Authorization', auth)
      .field('memberId', '3')
      .expect(400);
    await http()
      .patch(`${base}/documents/${doc.id}`)
      .set('Authorization', auth)
      .field('folderId', foreign.id)
      .expect(404);
    await http()
      .get(`${base}?folderId=${foreign.id}`)
      .set('Authorization', auth)
      .expect(404);
    await http()
      .delete(`${base}/folders/${foreign.id}`)
      .set('Authorization', auth)
      .expect(404);
    await expect(
      db.familyDocument.update({
        where: { id: doc.id },
        data: { memberId: 3 },
      }),
    ).rejects.toThrow();
    await expect(
      db.familyDocument.update({
        where: { id: doc.id },
        data: { folderId: foreign.id },
      }),
    ).rejects.toThrow();
  });
  it('serves images and rejects access revoked during download', async () => {
    const image = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a0S8AAAAASUVORK5CYII=',
      'base64',
    );
    const response = await http()
      .post(`${base}/documents`)
      .set('Authorization', auth)
      .field('name', 'Imagen')
      .field('memberId', '2')
      .attach('file', image, {
        filename: 'image.png',
        contentType: 'image/png',
      })
      .expect(201);
    const doc = response.body as { id: string };
    const opened = await http()
      .get(`${base}/documents/${doc.id}/content`)
      .set('Authorization', auth)
      .expect(200);
    expect(opened.headers['content-type']).toContain('image/png');
    storage.download.mockImplementationOnce(async () => {
      await db.member.delete({ where: { id: 1 } });
      return image;
    });
    await http()
      .get(`${base}/documents/${doc.id}/content`)
      .set('Authorization', auth)
      .expect(403);
  });

  it('concurrent replacements preserve a single current version', async () => {
    const doc = await upload();
    let release!: () => void;
    let waiting = 0;
    const barrier = new Promise<void>((resolve) => {
      release = resolve;
    });
    const synchronizeUpload = async (path: string, bytes: Buffer) => {
      objects.set(path, bytes);
      waiting++;
      if (waiting === 2) release();
      await barrier;
    };
    storage.upload
      .mockImplementationOnce(synchronizeUpload)
      .mockImplementationOnce(synchronizeUpload);
    const outcomes = await Promise.allSettled([
      service.save(
        1,
        1,
        {},
        { buffer: pdf, mimetype: 'application/pdf' },
        doc.id,
      ),
      service.save(
        1,
        1,
        {},
        { buffer: pdf, mimetype: 'application/pdf' },
        doc.id,
      ),
    ]);
    expect(
      outcomes.filter((result) => result.status === 'fulfilled'),
    ).toHaveLength(1);
    expect(await db.familyDocument.count()).toBe(1);
    expect(await db.documentObject.count({ where: { state: 'active' } })).toBe(
      1,
    );
  });
  it('failed upload/replacement preserves original; pending journal is retried on cleanup failure', async () => {
    const doc = await upload();
    const original = await db.familyDocument.findUniqueOrThrow({
      where: { id: doc.id },
    });
    failUpload = true;
    await http()
      .patch(`${base}/documents/${doc.id}`)
      .set('Authorization', auth)
      .field('name', 'Must not apply')
      .attach('file', pdf, {
        filename: 'new.pdf',
        contentType: 'application/pdf',
      })
      .expect(500);
    expect(
      await db.familyDocument.findUniqueOrThrow({ where: { id: doc.id } }),
    ).toEqual(original);
    await db.documentObject.updateMany({
      where: { state: 'pending' },
      data: { createdAt: new Date(0) },
    });
    failRemove = true;
    await service.cleanupAbandonedUploads();
    expect(await db.documentObject.count({ where: { state: 'pending' } })).toBe(
      1,
    );
    failRemove = false;
    await service.cleanupAbandonedUploads();
    expect(await db.documentObject.count({ where: { state: 'pending' } })).toBe(
      0,
    );
  });
  it('failed metadata commit after upload keeps old record and journals new object', async () => {
    const doc = await upload();
    const original = await db.familyDocument.findUniqueOrThrow({
      where: { id: doc.id },
    });
    await http()
      .patch(`${base}/documents/${doc.id}`)
      .set('Authorization', auth)
      .field('memberId', '3')
      .attach('file', pdf, {
        filename: 'new.pdf',
        contentType: 'application/pdf',
      })
      .expect(400);
    expect(
      await db.familyDocument.findUniqueOrThrow({ where: { id: doc.id } }),
    ).toEqual(original);
    expect(await db.documentObject.count({ where: { state: 'pending' } })).toBe(
      1,
    );
  });
  it('recursive deletion is atomic; files remain private until retention cleanup', async () => {
    const parent = await folder('Padre');
    const child = await folder('Hijo', parent.id);
    const doc = await upload(child.id);
    const row = await db.familyDocument.findUniqueOrThrow({
      where: { id: doc.id },
    });
    await http()
      .delete(`${base}/folders/${parent.id}`)
      .set('Authorization', auth)
      .expect(204);
    expect(await db.documentFolder.count()).toBe(0);
    expect(await db.familyDocument.count()).toBe(0);
    await http()
      .get(`${base}/documents/${doc.id}/content`)
      .set('Authorization', auth)
      .expect(404);
    await service.cleanupAbandonedUploads();
    expect(objects.has(row.objectPath)).toBe(true);
    await db.documentObject.updateMany({ data: { retiredAt: new Date(0) } });
    await service.cleanupAbandonedUploads();
    expect(objects.has(row.objectPath)).toBe(false);
  });
  it('database delete failure rolls back metadata and retirement together', async () => {
    const doc = await upload();
    await sql.query(
      `CREATE FUNCTION fail_document_delete() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'injected delete failure'; END $$; CREATE TRIGGER inject_delete_failure BEFORE DELETE ON "FamilyDocument" FOR EACH ROW EXECUTE FUNCTION fail_document_delete()`,
    );
    try {
      await http()
        .delete(`${base}/documents/${doc.id}`)
        .set('Authorization', auth)
        .expect(500);
      expect(await db.familyDocument.count()).toBe(1);
      expect(
        await db.documentObject.count({ where: { state: 'active' } }),
      ).toBe(1);
    } finally {
      await sql.query(
        'DROP TRIGGER inject_delete_failure ON "FamilyDocument"; DROP FUNCTION fail_document_delete()',
      );
    }
  });
  it('preserves group documents when associated member leaves; group deletion retires objects', async () => {
    const doc = await upload();
    await db.member.delete({ where: { id: 2 } });
    await http()
      .get(`${base}/documents/${doc.id}/content`)
      .set('Authorization', auth)
      .expect(200);
    await http()
      .patch(`${base}/documents/${doc.id}`)
      .set('Authorization', auth)
      .field('name', 'Retained')
      .expect(200);
    await db.member.deleteMany();
    await db.group.delete({ where: { id: 1 } });
    expect(await db.familyDocument.count()).toBe(0);
    expect(await db.documentObject.count({ where: { state: 'retired' } })).toBe(
      1,
    );
  });
});
