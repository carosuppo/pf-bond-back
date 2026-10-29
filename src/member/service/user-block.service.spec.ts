import { EventEmitter2 } from '@nestjs/event-emitter';
import type { IMemberRepository } from '../repository/member.repository.interface';
import type { IUserBlockRepository } from '../repository/user-block.repository.interface';
import {
  USER_BLOCK_CHANGED_EVENT,
  UserBlockService,
} from './user-block.service';

describe('UserBlockService', () => {
  const createService = (options?: { member?: object | null }) => {
    const userBlockRepository: Partial<IUserBlockRepository> = {
      block: jest.fn().mockResolvedValue(undefined),
      unblock: jest.fn().mockResolvedValue(undefined),
      findBlockedUsers: jest.fn().mockResolvedValue([]),
      findMutuallyBlockedUserIds: jest.fn().mockResolvedValue([]),
      hasDirectionalBlock: jest.fn().mockResolvedValue(true),
      hasBlockBetween: jest.fn().mockResolvedValue(true),
      hasBlockedMemberInGroup: jest.fn().mockResolvedValue(false),
    };
    const findByUserAndGroup = jest.fn().mockResolvedValue({ id: 3 });
    const memberRepository: Partial<IMemberRepository> = {
      findById: jest
        .fn()
        .mockResolvedValue(
          options && 'member' in options
            ? options.member
            : { id: 8, groupId: 12, userId: 5 },
        ),
      findByUserAndGroup,
    };
    const events = new EventEmitter2();
    const emit = jest.spyOn(events, 'emit');
    const service = new UserBlockService(
      userBlockRepository as unknown as IUserBlockRepository,
      memberRepository as unknown as IMemberRepository,
      events,
    );

    return {
      service,
      userBlockRepository,
      memberRepository,
      findByUserAndGroup,
      emit,
    };
  };

  it('creates a mutual block relationship without removing the group membership', async () => {
    const fixture = createService();

    await expect(fixture.service.blockMember(8, 7)).resolves.toEqual({
      message: 'El usuario fue bloqueado.',
    });

    expect(fixture.memberRepository.findByUserAndGroup).toHaveBeenCalledWith(
      7,
      12,
    );
    expect(fixture.userBlockRepository.block).toHaveBeenCalledWith(7, 5);
    expect(fixture.emit).toHaveBeenCalledWith(USER_BLOCK_CHANGED_EVENT, {
      blockerUserId: 7,
      blockedUserId: 5,
      isBlocked: true,
    });
  });

  it('does not block the requester or a member of another group', async () => {
    const self = createService({
      member: { id: 8, groupId: 12, userId: 7 },
    });
    await expect(self.service.blockMember(8, 7)).rejects.toThrow(
      'No puedes bloquear tu propia cuenta.',
    );

    const outsideGroup = createService();
    outsideGroup.findByUserAndGroup.mockResolvedValue(null);
    await expect(outsideGroup.service.blockMember(8, 7)).rejects.toThrow(
      'No perteneces a este grupo.',
    );
    expect(outsideGroup.userBlockRepository.block).not.toHaveBeenCalled();
  });

  it('unblocks only the relationship initiated by the current user', async () => {
    const fixture = createService();
    jest
      .spyOn(fixture.userBlockRepository, 'hasBlockBetween')
      .mockResolvedValue(false);

    await expect(fixture.service.unblockUser(5, 7)).resolves.toEqual({
      message: 'El usuario fue desbloqueado.',
    });
    expect(fixture.userBlockRepository.unblock).toHaveBeenCalledWith(7, 5);
    expect(fixture.emit).toHaveBeenCalledWith(USER_BLOCK_CHANGED_EVENT, {
      blockerUserId: 7,
      blockedUserId: 5,
      isBlocked: false,
    });
  });
});
