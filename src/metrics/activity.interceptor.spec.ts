import { ExecutionContext, Logger } from '@nestjs/common';
import { lastValueFrom, of, throwError } from 'rxjs';
import { ActivityInterceptor } from './activity.interceptor';

function context(
  controller: string,
  handler: string,
  type = 'http',
  userId: number | undefined = 7,
): ExecutionContext {
  return {
    getType: () => type,
    getClass: () => ({ name: controller }),
    getHandler: () => ({ name: handler }),
    switchToHttp: () => ({
      getRequest: () => ({
        user: userId === undefined ? undefined : { id: userId },
      }),
    }),
  } as unknown as ExecutionContext;
}

describe('ActivityInterceptor', () => {
  const record = jest.fn<Promise<void>, [number]>();
  const interceptor = new ActivityInterceptor({ record });
  beforeEach(() => record.mockReset().mockResolvedValue(undefined));

  it.each([
    ['GroupController', 'create'],
    ['EventController', 'cancel'],
    ['PointOfInterestController', 'remove'],
    ['UserController', 'updateMe'],
  ])(
    'records successful %s.%s without changing the response',
    async (controller, handler) => {
      const response = { ok: true };
      expect(
        await lastValueFrom(
          interceptor.intercept(context(controller, handler), {
            handle: () => of(response),
          }),
        ),
      ).toBe(response);
      expect(record).toHaveBeenCalledWith(7);
    },
  );

  it.each([
    ['LocationController', 'heartbeat', 'http'],
    ['LocationController', 'updateCurrentLocation', 'http'],
    ['GroupController', 'getAll', 'http'],
    ['UserController', 'me', 'http'],
    ['DevicePushTokenController', 'register', 'http'],
    ['GroupController', 'create', 'ws'],
    ['UnknownController', 'create', 'http'],
    ['UserController', 'deleteMe', 'http'],
  ])('excludes %s.%s (%s)', async (controller, handler, type) => {
    await lastValueFrom(
      interceptor.intercept(context(controller, handler, type), {
        handle: () => of(undefined),
      }),
    );
    expect(record).not.toHaveBeenCalled();
  });

  it('uses only the authenticated login result', async () => {
    await lastValueFrom(
      interceptor.intercept(context('UserController', 'login'), {
        handle: () => of({ user: { id: 9 } }),
      }),
    );
    expect(record).toHaveBeenCalledWith(9);
  });

  it('does not record failed operations', async () => {
    await expect(
      lastValueFrom(
        interceptor.intercept(context('GroupController', 'create'), {
          handle: () => throwError(() => new Error('failed')),
        }),
      ),
    ).rejects.toThrow('failed');
    expect(record).not.toHaveBeenCalled();
  });

  it('preserves successful operations when metric storage fails and logs no personal data', async () => {
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    record.mockRejectedValue(new Error('private database details'));
    expect(
      await lastValueFrom(
        interceptor.intercept(context('GroupController', 'create'), {
          handle: () => of('ok'),
        }),
      ),
    ).toBe('ok');
    expect(warn).toHaveBeenCalledWith('Activity metric could not be updated');
    warn.mockRestore();
  });
});
