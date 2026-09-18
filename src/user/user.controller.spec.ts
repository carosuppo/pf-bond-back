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
    const controller = new UserController(service as unknown as UserService);
    const file = {
      mimetype: 'image/jpeg',
      buffer: Buffer.from([0xff, 0xd8, 0xff]),
    };

    const result = await controller.updateProfilePhoto(file, 7);

    expect(service.updateProfilePhoto).toHaveBeenCalledWith(7, file);
    expect(result.profilePhoto).toBe('data:image/jpeg;base64,abc');
  });
});
