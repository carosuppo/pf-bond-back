import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { GroupService } from './group.service';
import { InvitationCodeHelper } from './helper/invitation-code.helper';
import { SupabaseStorageService } from '../user/storage/supabase-storage.service';
import { NotificationService } from '../notification/notification.service';
import { GroupEventService } from './group-event.service';

describe('GroupService', () => {
  let service: GroupService;

  const groupRepositoryMock = {
    create: jest.fn(),
    findByInvitationCode: jest.fn(),
    findByUserId: jest.fn(),
    update: jest.fn(),
    findById: jest.fn(),
    leave: jest.fn(),
    softDelete: jest.fn(),
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

  const groupJoinRequestRepositoryMock = {
    submit: jest.fn(),
    findPendingForAdmin: jest.fn(),
    findAdminUserIds: jest.fn(),
    accept: jest.fn(),
    reject: jest.fn(),
  };

  const notificationServiceMock = {
    sendToUsers: jest.fn(),
    sendToUser: jest.fn(),
  };

  const groupEventServiceMock = {
    publish: jest.fn(),
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
        {
          provide: 'groupJoinRequestRepository',
          useValue: groupJoinRequestRepositoryMock,
        },
        { provide: NotificationService, useValue: notificationServiceMock },
        { provide: GroupEventService, useValue: groupEventServiceMock },
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
      image: 'familia.png',
      description: null,
      shareLocationMandatorily: false,
      invitationCode: 'ABC123',
      deletedAt: null,
    };

    it('crea una solicitud pendiente sin agregar al usuario como miembro', async () => {
      groupRepositoryMock.findByInvitationCode.mockResolvedValue(activeGroup);
      memberRepositoryMock.findByUserAndGroup.mockResolvedValue(null);
      groupJoinRequestRepositoryMock.submit.mockResolvedValue({
        status: 'created',
        requestId: 22,
      });
      groupJoinRequestRepositoryMock.findAdminUserIds.mockResolvedValue([8]);
      notificationServiceMock.sendToUsers.mockResolvedValue(undefined);

      const result = await service.join({ invitationCode: 'ABC123' }, 7);

      expect(groupRepositoryMock.findByInvitationCode).toHaveBeenCalledWith(
        'ABC123',
      );
      expect(memberRepositoryMock.findByUserAndGroup).toHaveBeenCalledWith(
        7,
        1,
      );
      expect(groupJoinRequestRepositoryMock.submit).toHaveBeenCalledWith(1, 7);
      expect(memberRepositoryMock.addMember).not.toHaveBeenCalled();
      expect(notificationServiceMock.sendToUsers).toHaveBeenCalledWith(
        [8],
        expect.objectContaining({
          data: {
            type: 'GROUP_JOIN_REQUEST',
            groupId: '1',
            requestId: '22',
          },
        }),
      );
      expect(result).toEqual({
        message:
          'Tu solicitud para ingresar al grupo fue enviada correctamente.',
        group: {
          id: 1,
          name: 'Familia',
        },
        alreadyPending: false,
      });
    });

    it('does not create a duplicate pending join request', async () => {
      groupRepositoryMock.findByInvitationCode.mockResolvedValue(activeGroup);
      memberRepositoryMock.findByUserAndGroup.mockResolvedValue(null);
      groupJoinRequestRepositoryMock.submit.mockResolvedValue({
        status: 'pending',
        requestId: 22,
      });

      await expect(
        service.join({ invitationCode: 'ABC123' }, 7),
      ).resolves.toEqual({
        message: 'Ya enviaste una solicitud para ingresar a este grupo.',
        group: { id: 1, name: 'Familia' },
        alreadyPending: true,
      });

      expect(memberRepositoryMock.addMember).not.toHaveBeenCalled();
      expect(
        groupJoinRequestRepositoryMock.findAdminUserIds,
      ).not.toHaveBeenCalled();
      expect(notificationServiceMock.sendToUsers).not.toHaveBeenCalled();
    });

    it('sends requests to mandatory-location groups without checking device permissions', async () => {
      groupRepositoryMock.findByInvitationCode.mockResolvedValue({
        ...activeGroup,
        shareLocationMandatorily: true,
      });
      memberRepositoryMock.findByUserAndGroup.mockResolvedValue(null);
      groupJoinRequestRepositoryMock.submit.mockResolvedValue({
        status: 'created',
        requestId: 23,
      });
      groupJoinRequestRepositoryMock.findAdminUserIds.mockResolvedValue([]);

      await expect(
        service.join({ invitationCode: 'ABC123' }, 7),
      ).resolves.toEqual({
        message:
          'Tu solicitud para ingresar al grupo fue enviada correctamente.',
        group: { id: 1, name: 'Familia' },
        alreadyPending: false,
      });

      expect(groupJoinRequestRepositoryMock.submit).toHaveBeenCalledWith(1, 7);
      expect(memberRepositoryMock.addMember).not.toHaveBeenCalled();
    });

    it('falla si el código no existe', async () => {
      groupRepositoryMock.findByInvitationCode.mockResolvedValue(null);

      const joinAttempt = service.join({ invitationCode: 'ZZZ999' }, 7);

      await expect(joinAttempt).rejects.toThrow(BadRequestException);
      await expect(joinAttempt).rejects.toThrow(
        'El código de invitación es inválido o no corresponde a ningún grupo vigente.',
      );

      expect(memberRepositoryMock.addMember).not.toHaveBeenCalled();
      expect(groupJoinRequestRepositoryMock.submit).not.toHaveBeenCalled();
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
      expect(groupJoinRequestRepositoryMock.submit).not.toHaveBeenCalled();
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
        alreadyPending: false,
        group: {
          id: 1,
          name: 'Familia',
        },
      });

      expect(memberRepositoryMock.addMember).not.toHaveBeenCalled();
    });
  });

  describe('join request resolution', () => {
    const resolvedRequest = {
      status: 'resolved' as const,
      groupId: 1,
      groupName: 'Familia',
      requesterUserId: 7,
      requesterName: 'Ana',
    };

    it('notifies the requester after an administrator accepts', async () => {
      groupJoinRequestRepositoryMock.accept.mockResolvedValue(resolvedRequest);
      notificationServiceMock.sendToUser.mockResolvedValue(undefined);

      await expect(service.acceptJoinRequest(22, 8)).resolves.toEqual({
        message: 'Solicitud aceptada correctamente.',
      });

      expect(groupJoinRequestRepositoryMock.accept).toHaveBeenCalledWith(22, 8);
      expect(notificationServiceMock.sendToUser).toHaveBeenCalledWith(
        7,
        expect.objectContaining({
          data: { type: 'GROUP_JOIN_REQUEST_ACCEPTED', groupId: '1' },
        }),
      );
    });

    it('notifies the requester after an administrator rejects', async () => {
      groupJoinRequestRepositoryMock.reject.mockResolvedValue(resolvedRequest);
      notificationServiceMock.sendToUser.mockResolvedValue(undefined);

      await expect(service.rejectJoinRequest(22, 8)).resolves.toEqual({
        message: 'Solicitud rechazada correctamente.',
      });

      expect(groupJoinRequestRepositoryMock.reject).toHaveBeenCalledWith(22, 8);
      expect(notificationServiceMock.sendToUser).toHaveBeenCalledWith(
        7,
        expect.objectContaining({
          data: { type: 'GROUP_JOIN_REQUEST_REJECTED', groupId: '1' },
        }),
      );
    });
  });

  describe('delete', () => {
    const activeGroup = {
      id: 1,
      name: 'Familia',
      image: 'familia.png',
      description: null,
      shareLocationMandatorily: false,
      invitationCode: 'ABC123',
      deletedAt: null,
    };

    it('soft-deletes the group and publishes deletion for its members', async () => {
      groupRepositoryMock.findById.mockResolvedValue(activeGroup);
      memberRepositoryMock.findByUserAndGroup.mockResolvedValue({
        id: 10,
        role: 'ADMIN',
      });
      groupRepositoryMock.softDelete.mockResolvedValue(true);

      await service.delete(1, 7);

      expect(groupRepositoryMock.softDelete).toHaveBeenCalledWith(1);
      expect(groupEventServiceMock.publish).toHaveBeenCalledWith({
        event: 'groupDeleted',
        data: { groupId: 1, actorUserId: 7 },
      });
    });

    it('rejects deletion by a regular member', async () => {
      groupRepositoryMock.findById.mockResolvedValue(activeGroup);
      memberRepositoryMock.findByUserAndGroup.mockResolvedValue({
        id: 10,
        role: 'MEMBER',
      });

      await expect(service.delete(1, 7)).rejects.toThrow(ForbiddenException);
      expect(groupRepositoryMock.softDelete).not.toHaveBeenCalled();
      expect(groupEventServiceMock.publish).not.toHaveBeenCalled();
    });
  });

  describe('leave', () => {
    it('removes the current member and publishes their departure', async () => {
      groupRepositoryMock.leave.mockResolvedValue({
        status: 'left',
        memberId: 10,
      });

      await expect(service.leave(1, 7)).resolves.toEqual({
        message: 'Dejaste el grupo.',
      });

      expect(groupRepositoryMock.leave).toHaveBeenCalledWith(1, 7);
      expect(groupEventServiceMock.publish).toHaveBeenCalledWith({
        event: 'memberLeft',
        data: { groupId: 1, memberId: 10, userId: 7, actorUserId: 7 },
      });
    });

    it('publishes group deletion when its only member leaves', async () => {
      groupRepositoryMock.leave.mockResolvedValue({
        status: 'deleted',
        memberId: 10,
      });

      await service.leave(1, 7);

      expect(groupEventServiceMock.publish).toHaveBeenCalledWith({
        event: 'groupDeleted',
        data: { groupId: 1, actorUserId: 7 },
      });
    });

    it('rejects a user who does not belong to the group', async () => {
      groupRepositoryMock.leave.mockResolvedValue({ status: 'notMember' });

      await expect(service.leave(1, 7)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(groupEventServiceMock.publish).not.toHaveBeenCalled();
    });

    it('rejects a group that does not exist', async () => {
      groupRepositoryMock.leave.mockResolvedValue({ status: 'notFound' });

      await expect(service.leave(1, 7)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(groupEventServiceMock.publish).not.toHaveBeenCalled();
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
