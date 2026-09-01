import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { RoleEnum } from '@prisma/client';
import { MemberService } from './member.service';

describe('MemberService', () => {
  let service: MemberService;

  const memberRepositoryMock = {
    addMember: jest.fn(),
    findByUserAndGroup: jest.fn(),
    findByIdWithUser: jest.fn(),
    findById: jest.fn(),
    countAdminsByGroup: jest.fn(),
    updateRole: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MemberService,
        { provide: 'memberRepository', useValue: memberRepositoryMock },
      ],
    }).compile();

    service = module.get(MemberService);
  });

  describe('getMemberInfo', () => {
    it('returns the name and last location update of a member in the requester group', async () => {
      const lastSeenAt = new Date('2026-08-26T12:00:00Z');
      memberRepositoryMock.findByIdWithUser.mockResolvedValue({
        memberId: 10,
        groupId: 20,
        name: 'Alice',
        lastSeenAt,
      });
      memberRepositoryMock.findByUserAndGroup.mockResolvedValue({ id: 1 });

      await expect(service.getMemberInfo(10, 7)).resolves.toEqual({
        memberId: 10,
        name: 'Alice',
        lastSeenAt,
      });
    });

    it('throws NotFoundException when the marker/member does not exist', async () => {
      memberRepositoryMock.findByIdWithUser.mockResolvedValue(null);

      await expect(service.getMemberInfo(999, 7)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(memberRepositoryMock.findByUserAndGroup).not.toHaveBeenCalled();
    });

    it('throws ForbiddenException when the requester does not belong to the member group', async () => {
      memberRepositoryMock.findByIdWithUser.mockResolvedValue({
        memberId: 10,
        groupId: 20,
        name: 'Alice',
        lastSeenAt: new Date(),
      });
      memberRepositoryMock.findByUserAndGroup.mockResolvedValue(null);

      await expect(service.getMemberInfo(10, 7)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });
  });

  describe('updateMemberRole', () => {
    it('assigns the ADMIN role to a member', async () => {
      memberRepositoryMock.findById.mockResolvedValue({
        id: 10,
        groupId: 20,
        role: RoleEnum.MEMBER,
      });
      memberRepositoryMock.findByUserAndGroup.mockResolvedValue({
        id: 1,
        groupId: 20,
        role: RoleEnum.ADMIN,
      });
      memberRepositoryMock.updateRole.mockResolvedValue({ id: 10 });

      await expect(
        service.updateMemberRole(10, { role: RoleEnum.ADMIN }, 7),
      ).resolves.toEqual({
        message: 'El miembro ahora es Administrador.',
      });

      expect(memberRepositoryMock.updateRole).toHaveBeenCalledWith(
        10,
        RoleEnum.ADMIN,
      );
      expect(memberRepositoryMock.countAdminsByGroup).not.toHaveBeenCalled();
    });

    it('revokes the ADMIN role of a member', async () => {
      memberRepositoryMock.findById.mockResolvedValue({
        id: 10,
        groupId: 20,
        role: RoleEnum.ADMIN,
      });
      memberRepositoryMock.findByUserAndGroup.mockResolvedValue({
        id: 1,
        groupId: 20,
        role: RoleEnum.ADMIN,
      });
      memberRepositoryMock.countAdminsByGroup.mockResolvedValue(2);
      memberRepositoryMock.updateRole.mockResolvedValue({ id: 10 });

      await expect(
        service.updateMemberRole(10, { role: RoleEnum.MEMBER }, 7),
      ).resolves.toEqual({
        message: 'El miembro ahora es Miembro.',
      });

      expect(memberRepositoryMock.updateRole).toHaveBeenCalledWith(
        10,
        RoleEnum.MEMBER,
      );
    });

    it('throws NotFoundException when the member does not exist', async () => {
      memberRepositoryMock.findById.mockResolvedValue(null);

      await expect(
        service.updateMemberRole(999, { role: RoleEnum.ADMIN }, 7),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws ForbiddenException when the requester does not belong to the group', async () => {
      memberRepositoryMock.findById.mockResolvedValue({
        id: 10,
        groupId: 20,
        role: RoleEnum.MEMBER,
      });
      memberRepositoryMock.findByUserAndGroup.mockResolvedValue(null);

      await expect(
        service.updateMemberRole(10, { role: RoleEnum.ADMIN }, 7),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('throws ForbiddenException when the requester is not an admin', async () => {
      memberRepositoryMock.findById.mockResolvedValue({
        id: 10,
        groupId: 20,
        role: RoleEnum.MEMBER,
      });
      memberRepositoryMock.findByUserAndGroup.mockResolvedValue({
        id: 1,
        groupId: 20,
        role: RoleEnum.MEMBER,
      });

      await expect(
        service.updateMemberRole(10, { role: RoleEnum.ADMIN }, 7),
      ).rejects.toBeInstanceOf(ForbiddenException);

      expect(memberRepositoryMock.updateRole).not.toHaveBeenCalled();
    });

    it('throws ForbiddenException when revoking the only admin of the group', async () => {
      memberRepositoryMock.findById.mockResolvedValue({
        id: 1,
        groupId: 20,
        role: RoleEnum.ADMIN,
      });
      memberRepositoryMock.findByUserAndGroup.mockResolvedValue({
        id: 1,
        groupId: 20,
        role: RoleEnum.ADMIN,
      });
      memberRepositoryMock.countAdminsByGroup.mockResolvedValue(1);

      await expect(
        service.updateMemberRole(1, { role: RoleEnum.MEMBER }, 1),
      ).rejects.toBeInstanceOf(ForbiddenException);

      expect(memberRepositoryMock.updateRole).not.toHaveBeenCalled();
    });
  });
});
