import {
  BadRequestException,
  ConflictException,
  HttpException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { GroupService } from './group.service';
import { InvitationCodeHelper } from './helper/invitation-code.helper';

describe('GroupService', () => {
  let service: GroupService;

  const groupRepositoryMock = {
    create: jest.fn(),
    findByInvitationCode: jest.fn(),
    findByUserId: jest.fn(),
    update: jest.fn(),
    findById: jest.fn(),
  };

  const memberRepositoryMock = {
    addMember: jest.fn(),
    findByUserAndGroup: jest.fn(),
  };

  const invitationCodeHelperMock = {
    generate: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GroupService,
        { provide: 'groupRepository', useValue: groupRepositoryMock },
        { provide: 'memberRepository', useValue: memberRepositoryMock },
        { provide: InvitationCodeHelper, useValue: invitationCodeHelperMock },
      ],
    }).compile();

    service = module.get(GroupService);
  });

  describe('createGroup', () => {
    it('mantiene el invitationCode generado en la respuesta', async () => {
      invitationCodeHelperMock.generate.mockResolvedValue('ABCDEF');
      groupRepositoryMock.create.mockResolvedValue({
        id: 3,
        name: 'Familia',
        description: null,
        shareLocationMandatorily: false,
        invitationCode: 'ABCDEF',
        deletedAt: null,
      });

      const result = await service.createGroup(
        {
          name: 'Familia',
          shareLocationMandatorily: false,
        },
        7,
      );

      expect(result.invitationCode).toBe('ABCDEF');
      expect(groupRepositoryMock.create).toHaveBeenCalledWith(
        {
          name: 'Familia',
          description: undefined,
          shareLocationMandatorily: false,
          invitationCode: 'ABCDEF',
        },
        7,
      );
    });
  });

  describe('join', () => {
    const activeGroup = {
      id: 1,
      name: 'Familia',
      description: null,
      shareLocationMandatorily: false,
      invitationCode: 'ABC123',
      deletedAt: null,
    };

    it('agrega al usuario como miembro cuando el código es válido', async () => {
      groupRepositoryMock.findByInvitationCode.mockResolvedValue(activeGroup);
      memberRepositoryMock.findByUserAndGroup.mockResolvedValue(null);
      memberRepositoryMock.addMember.mockResolvedValue({ id: 10 });

      const result = await service.join({ invitationCode: 'ABC123' }, 7);

      expect(groupRepositoryMock.findByInvitationCode).toHaveBeenCalledWith(
        'ABC123',
      );
      expect(memberRepositoryMock.findByUserAndGroup).toHaveBeenCalledWith(
        7,
        1,
      );
      expect(memberRepositoryMock.addMember).toHaveBeenCalledWith({
        groupId: 1,
        userId: 7,
        role: 'MEMBER',
      });
      expect(result).toEqual({
        message: 'Ingresaste al grupo correctamente.',
        group: {
          id: 1,
          name: 'Familia',
        },
      });
    });

    it('falla si el código no existe', async () => {
      groupRepositoryMock.findByInvitationCode.mockResolvedValue(null);

      const joinAttempt = service.join({ invitationCode: 'ZZZ999' }, 7);

      await expect(joinAttempt).rejects.toThrow(BadRequestException);
      await expect(joinAttempt).rejects.toThrow(
        'El código de invitación es inválido o no corresponde a ningún grupo vigente.',
      );

      expect(memberRepositoryMock.addMember).not.toHaveBeenCalled();
    });

    it('falla si el grupo no está vigente', async () => {
      groupRepositoryMock.findByInvitationCode.mockResolvedValue({
        ...activeGroup,
        deletedAt: new Date(),
      });

      const joinAttempt = service.join({ invitationCode: 'ABC123' }, 7);

      await expect(joinAttempt).rejects.toThrow(BadRequestException);
      await expect(joinAttempt).rejects.toThrow(
        'El código de invitación es inválido o no corresponde a ningún grupo vigente.',
      );

      expect(memberRepositoryMock.addMember).not.toHaveBeenCalled();
    });

    it('falla si el usuario ya es miembro y no crea registros duplicados', async () => {
      groupRepositoryMock.findByInvitationCode.mockResolvedValue(activeGroup);
      memberRepositoryMock.findByUserAndGroup.mockResolvedValue({ id: 10 });

      let error: unknown;
      try {
        await service.join({ invitationCode: 'ABC123' }, 7);
      } catch (caughtError) {
        error = caughtError;
      }

      expect(error).toBeInstanceOf(ConflictException);
      expect((error as HttpException).getResponse()).toEqual({
        message: 'Ya eres miembro de este grupo.',
        group: {
          id: 1,
          name: 'Familia',
        },
      });

      expect(memberRepositoryMock.addMember).not.toHaveBeenCalled();
    });
  });
});
