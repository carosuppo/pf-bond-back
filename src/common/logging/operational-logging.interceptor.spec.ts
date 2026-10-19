import {
  BadRequestException,
  CallHandler,
  ExecutionContext,
  InternalServerErrorException,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { firstValueFrom, throwError } from 'rxjs';
import { OperationalLoggingInterceptor } from './operational-logging.interceptor';

describe('OperationalLoggingInterceptor', () => {
  class TestController {
    update(this: void): void {}
  }

  class HealthController {
    check(this: void): void {}
  }

  let interceptor: OperationalLoggingInterceptor;
  let logger: jest.SpyInstance;
  const logged: string[] = [];

  beforeEach(() => {
    interceptor = new OperationalLoggingInterceptor();
    logged.length = 0;
    logger = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation((message) => {
        logged.push(String(message));
      });
  });

  afterEach(() => jest.restoreAllMocks());

  it('logs a failed HTTP operation without exposing its error message', async () => {
    const error = new Error('token=private email=person@example.com');
    const context = {
      getType: () => 'http',
      getClass: () => TestController,
      getHandler: () => TestController.prototype.update,
    } as unknown as ExecutionContext;
    const next = {
      handle: () => throwError(() => error),
    } as CallHandler;

    await expect(
      firstValueFrom(interceptor.intercept(context, next)),
    ).rejects.toMatchObject(
      new InternalServerErrorException('Internal server error'),
    );

    expect(logger).toHaveBeenCalledWith(
      'module=TestController operation=update status=500 errorType=Error',
    );
    expect(logged[0]).not.toContain('private');
    expect(logged[0]).not.toContain('person@example.com');
  });

  it('does not log client errors and preserves them', async () => {
    const error = new BadRequestException('invalid request');
    const context = {
      getType: () => 'http',
      getClass: () => TestController,
      getHandler: () => TestController.prototype.update,
    } as unknown as ExecutionContext;
    const next = {
      handle: () => throwError(() => error),
    } as CallHandler;

    await expect(
      firstValueFrom(interceptor.intercept(context, next)),
    ).rejects.toBe(error);

    expect(logger).not.toHaveBeenCalled();
  });

  it('avoids duplicating database health failures already logged by HealthService', async () => {
    const error = new ServiceUnavailableException('Service unavailable');
    const context = {
      getType: () => 'http',
      getClass: () => HealthController,
      getHandler: () => HealthController.prototype.check,
    } as unknown as ExecutionContext;
    const next = {
      handle: () => throwError(() => error),
    } as CallHandler;

    await expect(
      firstValueFrom(interceptor.intercept(context, next)),
    ).rejects.toBe(error);

    expect(logger).not.toHaveBeenCalled();
  });
});
