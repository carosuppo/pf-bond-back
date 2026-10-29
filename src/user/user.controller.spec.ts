import type { Response } from 'express';
import { AccountDeletionService } from './service/account-deletion.service';
import { AccountDeletionRequestService } from './service/account-deletion-request.service';
import { UserController } from './user.controller';
import { UserService } from './user.service';

describe('UserController', () => {
  it('actualiza la foto usando el usuario autenticado', async () => {
    const service = {
      updateProfilePhoto: jest.fn().mockResolvedValue({
        id: 7,
        profilePhoto: 'data:image/jpeg;base64,abc',
      }),
    };
    const controller = new UserController(
      service as unknown as UserService,
      {} as AccountDeletionService,
      {} as AccountDeletionRequestService,
    );
    const file = {
      mimetype: 'image/jpeg',
      buffer: Buffer.from([0xff, 0xd8, 0xff]),
    };

    const result = await controller.updateProfilePhoto(file, 7);

    expect(service.updateProfilePhoto).toHaveBeenCalledWith(7, file);
    expect(result.profilePhoto).toBe('data:image/jpeg;base64,abc');
  });

  it('redirige a Bond después de verificar el correo', async () => {
    const service = {
      verifyEmail: jest.fn().mockResolvedValue(undefined),
    };
    const controller = new UserController(
      service as unknown as UserService,
      {} as AccountDeletionService,
      {} as AccountDeletionRequestService,
    );
    const response = {
      setHeader: jest.fn(),
      redirect: jest.fn(),
    };

    await controller.verifyEmail(
      { token: 'verification-token' },
      response as unknown as Response,
    );

    expect(service.verifyEmail).toHaveBeenCalledWith({
      token: 'verification-token',
    });
    expect(response.setHeader).toHaveBeenCalledWith(
      'Cache-Control',
      'no-store',
    );
    expect(response.redirect).toHaveBeenCalledWith(
      302,
      'bond://verify-email?token=verification-token',
    );
  });
});
