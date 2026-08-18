import { BadRequestException, ConflictException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { GroupService } from './group.service';
import { InvitationCodeHelper } from './helper/invitation-code.helper';

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

      await expect(
        service.join({ invitationCode: 'ZZZ999' }, 7),
      ).rejects.toThrow(BadRequestException);

      expect(memberRepositoryMock.addMember).not.toHaveBeenCalled();
    });

    it('falla si el grupo no está vigente', async () => {
      groupRepositoryMock.findByInvitationCode.mockResolvedValue({
        ...activeGroup,
        deletedAt: new Date(),
      });

      await expect(
        service.join({ invitationCode: 'ABC123' }, 7),
      ).rejects.toThrow(BadRequestException);

      expect(memberRepositoryMock.addMember).not.toHaveBeenCalled();
    });

    it('falla si el usuario ya es miembro y no crea registros duplicados', async () => {
      groupRepositoryMock.findByInvitationCode.mockResolvedValue(activeGroup);
      memberRepositoryMock.findByUserAndGroup.mockResolvedValue({ id: 10 });

      await expect(
        service.join({ invitationCode: 'ABC123' }, 7),
      ).rejects.toThrow(ConflictException);

      expect(memberRepositoryMock.addMember).not.toHaveBeenCalled();
    });
  });
});
