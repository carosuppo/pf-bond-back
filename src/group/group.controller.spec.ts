import { GroupController } from './group.controller';
import { GroupService } from './group.service';

describe('GroupController', () => {
  let controller: GroupController;

  const groupServiceMock = {
    join: jest.fn(),
    delete: jest.fn(),
    getJoinRequests: jest.fn(),
    acceptJoinRequest: jest.fn(),
    rejectJoinRequest: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();

    controller = new GroupController(
      groupServiceMock as unknown as GroupService,
    );
  });

  describe('join', () => {
    it('delega el ingreso al servicio con el DTO y el usuario autenticado', async () => {
      groupServiceMock.join.mockResolvedValue({
        message: 'Ingresaste al grupo correctamente.',
        group: { id: 1, name: 'Familia' },
        alreadyPending: false,
      });

      const result = await controller.join({ invitationCode: 'ABC123' }, 7);

      expect(groupServiceMock.join).toHaveBeenCalledWith(
        { invitationCode: 'ABC123' },
        7,
      );
      expect(result).toEqual({
        message: 'Ingresaste al grupo correctamente.',
        group: { id: 1, name: 'Familia' },
        alreadyPending: false,
      });
    });

    it('lista las solicitudes para el usuario autenticado', async () => {
      groupServiceMock.getJoinRequests.mockResolvedValue([]);

      await expect(controller.getJoinRequests(8)).resolves.toEqual([]);
      expect(groupServiceMock.getJoinRequests).toHaveBeenCalledWith(8);
    });

    it('delegates acceptance using the authenticated administrator', async () => {
      groupServiceMock.acceptJoinRequest.mockResolvedValue({
        message: 'Solicitud aceptada correctamente.',
      });

      await expect(controller.acceptJoinRequest(22, 8)).resolves.toEqual({
        message: 'Solicitud aceptada correctamente.',
      });
      expect(groupServiceMock.acceptJoinRequest).toHaveBeenCalledWith(22, 8);
    });

    it('delegates rejection using the authenticated administrator', async () => {
      groupServiceMock.rejectJoinRequest.mockResolvedValue({
        message: 'Solicitud rechazada correctamente.',
      });

      await expect(controller.rejectJoinRequest(22, 8)).resolves.toEqual({
        message: 'Solicitud rechazada correctamente.',
      });
      expect(groupServiceMock.rejectJoinRequest).toHaveBeenCalledWith(22, 8);
    });

    it('no ejecuta ninguna operación si el ingreso se cancela antes de confirmar', () => {
      // Al presionar "Atrás" el frontend no envía la petición al endpoint:
      // el controller jamás invoca al servicio y no se crea ningún registro.
      expect(groupServiceMock.join).not.toHaveBeenCalled();
    });
  });

  describe('delete', () => {
    it('delega la eliminación con el grupo y usuario autenticado', async () => {
      groupServiceMock.delete.mockResolvedValue(undefined);

      await expect(controller.delete(3, 7)).resolves.toBeUndefined();

      expect(groupServiceMock.delete).toHaveBeenCalledWith(3, 7);
    });
  });
});
