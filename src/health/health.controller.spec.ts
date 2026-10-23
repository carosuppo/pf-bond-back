import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { PrismaService } from '../prisma/prisma.service';
import { HealthModule } from './health.module';

describe('HealthController', () => {
  let app: INestApplication<App>;
  let queryRaw: jest.Mock;

  beforeEach(async () => {
    queryRaw = jest.fn().mockResolvedValue([{ '?column?': 1 }]);
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [HealthModule],
    })
      .overrideProvider(PrismaService)
      .useValue({ $queryRaw: queryRaw })
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('reports the API and database as healthy', async () => {
    await request(app.getHttpServer())
      .get('/health')
      .expect(200)
      .expect({ status: 'ok', database: 'ok' });

    expect(queryRaw.mock.calls).toHaveLength(1);
  });

  it('reports the API as unavailable when PostgreSQL cannot be reached', async () => {
    queryRaw.mockRejectedValueOnce(new Error('database error'));

    await request(app.getHttpServer()).get('/health').expect(503);
  });
});
