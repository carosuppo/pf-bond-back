import { ForbiddenException } from '@nestjs/common';
import { RolesGuard } from './roles.guard';

describe('RolesGuard', () => {
  it('permite acceso si no hay roles', () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(undefined),
    };
    const guard = new RolesGuard(reflector as never);

    const result = guard.canActivate({
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({ getRequest: () => ({}) }),
    } as never);

    expect(result).toBe(true);
  });

  it('lanza error si no hay usuario', () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(['ADMIN']),
    };
    const guard = new RolesGuard(reflector as never);

    expect(() =>
      guard.canActivate({
        getHandler: () => ({}),
        getClass: () => ({}),
        switchToHttp: () => ({ getRequest: () => ({}) }),
      } as never),
    ).toThrow(ForbiddenException);
  });

  it('lanza error si rol no permitido', () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(['ADMIN']),
    };
    const guard = new RolesGuard(reflector as never);

    expect(() =>
      guard.canActivate({
        getHandler: () => ({}),
        getClass: () => ({}),
        switchToHttp: () => ({
          getRequest: () => ({ user: { role: 'USER' } }),
        }),
      } as never),
    ).toThrow(ForbiddenException);
  });

  it('permite acceso si rol permitido', () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(['USER']),
    };
    const guard = new RolesGuard(reflector as never);

    const result = guard.canActivate({
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({
        getRequest: () => ({ user: { role: 'USER' } }),
      }),
    } as never);

    expect(result).toBe(true);
  });
});
