import { Logger } from '@nestjs/common';
import { SecurityEventType } from '@prisma/client';
import { Response } from 'express';
import type { AuthenticatedRequest } from '../user/interface/authenticated-request.interface';
import { SecurityMonitoringMiddleware } from './security-monitoring.middleware';
import { SecurityMonitoringService } from './security-monitoring.service';

describe('SecurityMonitoringMiddleware', () => {
  let record: jest.Mock;
  let middleware: SecurityMonitoringMiddleware;
  let warning: jest.SpyInstance;

  beforeEach(() => {
    record = jest.fn().mockResolvedValue(undefined);
    warning = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
    middleware = new SecurityMonitoringMiddleware({
      record,
    } as unknown as SecurityMonitoringService);
  });

  afterEach(() => jest.restoreAllMocks());

  it('registra el 401 de login pero no el 403 de email sin verificar', () => {
    finishRequest('POST', '/user/login', 401, {
      email: 'user@example.com',
      password: 'not-persisted',
    });

    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({
        type: SecurityEventType.AUTH_LOGIN_FAILED,
        loginEmail: 'user@example.com',
      }),
    );

    record.mockClear();
    warning.mockClear();
    finishRequest('POST', '/user/login', 403, {
      email: 'user@example.com',
      password: 'correct-password',
    });
    expect(record).not.toHaveBeenCalled();
    expect(warning).toHaveBeenCalledWith(
      'module=User operation=POST_user/login status=403',
    );
    expect(JSON.stringify(warning.mock.calls)).not.toContain(
      'user@example.com',
    );
    expect(JSON.stringify(warning.mock.calls)).not.toContain(
      'correct-password',
    );
  });

  it('registra un 401 bajo location sin guardar el query string', () => {
    finishRequest('GET', '/location/sharing?opaque=value', 401);

    expect(record).toHaveBeenCalledWith({
      type: SecurityEventType.LOCATION_UNAUTHORIZED,
      ip: '203.0.113.30',
      userId: null,
      method: 'GET',
      path: '/location/sharing',
      statusCode: 401,
    });
  });

  it('registra el 403 de acceso a un grupo ajeno', () => {
    finishRequest(
      'GET',
      '/location/group/99/members',
      403,
      undefined,
      7,
      '/location/group/:groupId/members',
    );

    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({
        type: SecurityEventType.LOCATION_FORBIDDEN,
        userId: 7,
        path: '/location/group/99/members',
      }),
    );
    expect(warning).toHaveBeenCalledWith(
      'module=Location operation=GET_location/group/param/members status=403',
    );
    expect(JSON.stringify(warning.mock.calls)).not.toContain('/99/');
  });

  it.each(['/location/current', '/location/heartbeat'])(
    'ignora el 403 operativo de %s',
    (path) => {
      finishRequest('PUT', path, 403, undefined, 7);
      expect(record).not.toHaveBeenCalled();
      expect(warning).toHaveBeenCalledWith(
        `module=Location operation=PUT_${path.slice(1)} status=403`,
      );
    },
  );

  function finishRequest(
    method: string,
    originalUrl: string,
    statusCode: number,
    body?: unknown,
    userId?: number,
    routePath?: string,
  ): void {
    let finishListener: (() => void) | undefined;
    const response = {
      statusCode,
      once: jest.fn((_event: string, listener: () => void) => {
        finishListener = listener;
        return response;
      }),
    } as unknown as Response;
    const request = {
      method,
      originalUrl,
      route: { path: routePath ?? originalUrl.split('?', 1)[0] },
      ip: '203.0.113.30',
      socket: { remoteAddress: '127.0.0.1' },
      body,
      user: userId === undefined ? undefined : { id: userId },
    } as unknown as AuthenticatedRequest;
    const next = jest.fn();

    middleware.use(request, response, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(finishListener).toBeDefined();
    finishListener?.();
  }
});
