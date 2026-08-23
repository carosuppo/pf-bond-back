import { GroupController } from './group.controller';
import { GroupService } from './group.service';

describe('GroupController', () => {
  let controller: GroupController;

  const groupServiceMock = {
    join: jest.fn(),
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
      });

      const result = await controller.join({ invitationCode: 'ABC123' }, 7);

      expect(groupServiceMock.join).toHaveBeenCalledWith(
        { invitationCode: 'ABC123' },
        7,
      );
      expect(result).toEqual({
        message: 'Ingresaste al grupo correctamente.',
      });
    });

    it('no ejecuta ninguna operación si el ingreso se cancela antes de confirmar', () => {
      // Al presionar "Atrás" el frontend no envía la petición al endpoint:
      // el controller jamás invoca al servicio y no se crea ningún registro.
      expect(groupServiceMock.join).not.toHaveBeenCalled();
    });
  });
});
