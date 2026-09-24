import { BadRequestException, ConflictException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { GroupService } from './group.service';
import { InvitationCodeHelper } from './helper/invitation-code.helper';
import { SupabaseStorageService } from '../user/storage/supabase-storage.service';

describe('GroupService', () => {
  let service: GroupService;

  const groupRepositoryMock = {
    create: jest.fn(),
    findByInvitationCode: jest.fn(),
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

  const supabaseStorageServiceMock = {
    getRandomDefaultGroupImage: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GroupService,
        { provide: 'groupRepository', useValue: groupRepositoryMock },
        { provide: 'memberRepository', useValue: memberRepositoryMock },
        { provide: InvitationCodeHelper, useValue: invitationCodeHelperMock },
        {
          provide: SupabaseStorageService,
          useValue: supabaseStorageServiceMock,
        },
      ],
    }).compile();

    service = module.get(GroupService);
  });

  describe('join', () => {
    const activeGroup = {
      id: 1,
      name: 'Familia',
      image: 'familia.png',
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

      const joinAttempt = service.join({ invitationCode: 'ABC123' }, 7);

      await expect(joinAttempt).rejects.toThrow(ConflictException);
      await expect(joinAttempt).rejects.toThrow(
        'Ya eres miembro de este grupo.',
      );

      expect(memberRepositoryMock.addMember).not.toHaveBeenCalled();
    });
  });

  describe('createGroup', () => {
    it('asigna una imagen predeterminada aleatoria', async () => {
      const image =
        'https://supabase.co/storage/v1/object/public/Bond/groups/defaults/group-default3.png';
      const createdGroup = {
        id: 1,
        name: 'Familia',
        image,
        description: null,
        shareLocationMandatorily: false,
        invitationCode: 'ABC123',
        deletedAt: null,
      };

      invitationCodeHelperMock.generate.mockResolvedValue('ABC123');
      supabaseStorageServiceMock.getRandomDefaultGroupImage.mockResolvedValue(
        image,
      );
      groupRepositoryMock.create.mockResolvedValue(createdGroup);

      const result = await service.createGroup(
        {
          name: 'Familia',
          description: 'Grupo familiar',
          shareLocationMandatorily: false,
        },
        7,
      );

      expect(
        supabaseStorageServiceMock.getRandomDefaultGroupImage,
      ).toHaveBeenCalled();
      expect(groupRepositoryMock.create).toHaveBeenCalledWith(
        {
          name: 'Familia',
          image,
          description: 'Grupo familiar',
          shareLocationMandatorily: false,
          invitationCode: 'ABC123',
        },
        7,
      );
      expect(result.image).toBe(image);
    });
  });
});
