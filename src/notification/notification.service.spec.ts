import { Test, TestingModule } from '@nestjs/testing';

import { FirebasePushService } from './firebase/firebase-push.service';
import { NotificationService } from './notification.service';

describe('NotificationService', () => {
  let service: NotificationService;

  const repository = {
    register: jest.fn(),
    unregister: jest.fn(),
    findByUserIds: jest.fn(),
    findActiveUserIdsByGroup: jest.fn(),
    findPointOfInterestNotificationContext: jest.fn(),
    deleteByTokens: jest.fn(),
  };
  const firebasePushService = {
    sendToTokens: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    firebasePushService.sendToTokens.mockResolvedValue({ invalidTokens: [] });
    repository.deleteByTokens.mockResolvedValue(undefined);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationService,
        { provide: 'devicePushTokenRepository', useValue: repository },
        { provide: FirebasePushService, useValue: firebasePushService },
      ],
    }).compile();

    service = module.get(NotificationService);
  });

  it('registra el token para el usuario autenticado', async () => {
    repository.register.mockResolvedValue(undefined);

    await service.registerDeviceToken(7, 'token-1', 'android');

    expect(repository.register).toHaveBeenCalledWith(7, 'token-1', 'android');
  });

  it('permite registrar el mismo token nuevamente de forma idempotente', async () => {
    repository.register.mockResolvedValue(undefined);

    await service.registerDeviceToken(7, 'token-1', 'android');
    await service.registerDeviceToken(7, 'token-1', 'android');

    expect(repository.register).toHaveBeenCalledTimes(2);
    expect(repository.register).toHaveBeenLastCalledWith(
      7,
      'token-1',
      'android',
    );
  });

  it('desregistra únicamente el token indicado para el usuario', async () => {
    repository.unregister.mockResolvedValue(undefined);

    await service.unregisterDeviceToken(7, 'token-1');

    expect(repository.unregister).toHaveBeenCalledWith(7, 'token-1');
  });

  it('envía al grupo excluyendo al actor y soporta múltiples dispositivos', async () => {
    repository.findActiveUserIdsByGroup.mockResolvedValue([8, 9]);
    repository.findByUserIds.mockResolvedValue([
      { userId: 8, token: 'ana-phone' },
      { userId: 8, token: 'ana-tablet' },
    ]);
    const message = {
      title: 'Título',
      body: 'Mensaje',
      data: { type: 'TEST' },
    };

    await service.sendToGroupExceptUser(3, 7, message);

    expect(repository.findActiveUserIdsByGroup).toHaveBeenCalledWith(3, 7);
    expect(firebasePushService.sendToTokens).toHaveBeenCalledWith(
      ['ana-phone', 'ana-tablet'],
      message,
    );
  });

  it('no invoca Firebase cuando los usuarios no tienen tokens', async () => {
    repository.findByUserIds.mockResolvedValue([]);

    await expect(
      service.sendToUsers([8], { title: 'Título', body: 'Mensaje', data: {} }),
    ).resolves.toBeUndefined();
    expect(firebasePushService.sendToTokens).not.toHaveBeenCalled();
  });

  it('elimina solamente tokens que Firebase identifica como inválidos', async () => {
    repository.findByUserIds.mockResolvedValue([
      { userId: 8, token: 'dead-token' },
      { userId: 9, token: 'live-token' },
    ]);
    firebasePushService.sendToTokens.mockResolvedValue({
      invalidTokens: ['dead-token'],
    });

    await service.sendToUsers([8, 9], {
      title: 'Título',
      body: 'Mensaje',
      data: {},
    });

    expect(repository.deleteByTokens).toHaveBeenCalledWith(['dead-token']);
  });
});
