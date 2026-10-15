import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { Server } from 'http';
import { createHash } from 'crypto';
import { ActivityController } from './activity.controller';
import { ActivityService } from './activity.service';
import { SessionAuthGuard } from '../user/guard/session-auth.guard';
import { SessionAuthenticationService } from '../user/service/session-authentication.service';
import { LocationController } from '../location/location.controller';
import { LocationService } from '../location/location.service';

describe('Foreground activity HTTP', () => {
  let app: INestApplication<Server>;
  const record = jest.fn<Promise<void>, [number]>();
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [ActivityController, LocationController],
      providers: [
        ActivityService,
        SessionAuthGuard,
        SessionAuthenticationService,
        { provide: 'activityRepository', useValue: { record } },
        {
          provide: 'userSessionRepository',
          useValue: {
            findActiveByTokenHash: jest
              .fn()
              .mockImplementation((hash: string) =>
                Promise.resolve(
                  hash === createHash('sha256').update('valid').digest('hex')
                    ? {
                        id: 12,
                        user: {
                          id: 7,
                          name: 'test',
                          email: 'test@example.test',
                          profilePhoto: null,
                        },
                      }
                    : null,
                ),
              ),
          },
        },
        {
          provide: LocationService,
          useValue: {
            heartbeat: jest.fn().mockResolvedValue({}),
            updateCurrentLocation: jest.fn().mockResolvedValue({}),
            getGroupMembers: jest.fn().mockResolvedValue([]),
          },
        },
      ],
    }).compile();
    app = module.createNestApplication();
    await app.init();
  });
  beforeEach(() => record.mockReset().mockResolvedValue(undefined));
  afterAll(async () => app.close());

  it('accepts a bodyless authenticated signal and returns no personal or aggregate data', async () => {
    await request(app.getHttpServer())
      .post('/user/activity')
      .set('Authorization', 'Bearer valid')
      .expect(204)
      .expect('');
    expect(record).toHaveBeenCalledWith(7);
  });
  it('never takes identity from the body', async () => {
    await request(app.getHttpServer())
      .post('/user/activity')
      .set('Authorization', 'Bearer valid')
      .send({ userId: 999 })
      .expect(204);
    expect(record).toHaveBeenCalledWith(7);
  });
  it('rejects an unauthenticated signal', async () => {
    await request(app.getHttpServer())
      .post('/user/activity')
      .send({ userId: 7 })
      .expect(401);
    expect(record).not.toHaveBeenCalled();
  });
  it('rejects an expired or invalid session', async () => {
    await request(app.getHttpServer())
      .post('/user/activity')
      .set('Authorization', 'Bearer expired')
      .expect(401);
    expect(record).not.toHaveBeenCalled();
  });
  it('does not register background GPS, heartbeats or map reads', async () => {
    await request(app.getHttpServer())
      .put('/location/heartbeat')
      .set('Authorization', 'Bearer valid')
      .expect(200);
    await request(app.getHttpServer())
      .put('/location/current')
      .set('Authorization', 'Bearer valid')
      .send({ latitude: 0, longitude: 0 })
      .expect(200);
    await request(app.getHttpServer())
      .get('/location/group/1/members')
      .set('Authorization', 'Bearer valid')
      .expect(200);
    expect(record).not.toHaveBeenCalled();
  });
  it('contains storage errors within the activity endpoint', async () => {
    record.mockRejectedValue(new Error('private database details'));
    const result = await request(app.getHttpServer())
      .post('/user/activity')
      .set('Authorization', 'Bearer valid')
      .expect(503);
    expect(result.text).not.toContain('private database details');
    await request(app.getHttpServer())
      .put('/location/heartbeat')
      .set('Authorization', 'Bearer valid')
      .expect(200);
  });
});
