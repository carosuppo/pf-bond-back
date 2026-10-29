import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { MessageResponseDto } from '../../user/dto/message-response.dto';
import { BlockedUserResponseDto } from '../dto/blocked-user-response.dto';
import type { IMemberRepository } from '../repository/member.repository.interface';
import type { IUserBlockRepository } from '../repository/user-block.repository.interface';

export const USER_BLOCK_CHANGED_EVENT = 'user.block.changed';

export interface UserBlockChangedEvent {
  blockerUserId: number;
  blockedUserId: number;
  isBlocked: boolean;
}

@Injectable()
export class UserBlockService {
  constructor(
    @Inject('userBlockRepository')
    private readonly userBlockRepository: IUserBlockRepository,
    @Inject('memberRepository')
    private readonly memberRepository: IMemberRepository,
    private readonly events: EventEmitter2,
  ) {}

  async blockMember(
    memberId: number,
    blockerUserId: number,
  ): Promise<MessageResponseDto> {
    const member = await this.memberRepository.findById(memberId);
    if (!member) throw new NotFoundException('El miembro no existe.');
    if (member.userId === blockerUserId) {
      throw new BadRequestException('No puedes bloquear tu propia cuenta.');
    }

    const blockerMembership = await this.memberRepository.findByUserAndGroup(
      blockerUserId,
      member.groupId,
    );
    if (!blockerMembership) {
      throw new ForbiddenException('No perteneces a este grupo.');
    }

    await this.userBlockRepository.block(blockerUserId, member.userId);
    const isBlocked = await this.userBlockRepository.hasBlockBetween(
      blockerUserId,
      member.userId,
    );
    this.events.emit(USER_BLOCK_CHANGED_EVENT, {
      blockerUserId,
      blockedUserId: member.userId,
      isBlocked,
    } satisfies UserBlockChangedEvent);

    return { message: 'El usuario fue bloqueado.' };
  }

  async getBlockedUsers(userId: number): Promise<BlockedUserResponseDto[]> {
    return this.userBlockRepository.findBlockedUsers(userId);
  }

  async unblockUser(
    blockedUserId: number,
    blockerUserId: number,
  ): Promise<MessageResponseDto> {
    if (blockedUserId === blockerUserId) {
      throw new BadRequestException('No puedes desbloquear tu propia cuenta.');
    }
    if (
      !(await this.userBlockRepository.hasDirectionalBlock(
        blockerUserId,
        blockedUserId,
      ))
    ) {
      throw new NotFoundException('No tienes bloqueado a este usuario.');
    }

    await this.userBlockRepository.unblock(blockerUserId, blockedUserId);
    const isBlocked = await this.userBlockRepository.hasBlockBetween(
      blockerUserId,
      blockedUserId,
    );
    this.events.emit(USER_BLOCK_CHANGED_EVENT, {
      blockerUserId,
      blockedUserId,
      isBlocked,
    } satisfies UserBlockChangedEvent);

    return { message: 'El usuario fue desbloqueado.' };
  }
}
