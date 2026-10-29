import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type {
  BlockedUserRecord,
  IUserBlockRepository,
} from './user-block.repository.interface';

@Injectable()
export class UserBlockPrismaRepository implements IUserBlockRepository {
  constructor(private readonly prismaService: PrismaService) {}

  async block(blockerUserId: number, blockedUserId: number): Promise<void> {
    await this.prismaService.userBlock.upsert({
      where: { blockerUserId_blockedUserId: { blockerUserId, blockedUserId } },
      create: { blockerUserId, blockedUserId },
      update: {},
    });
  }

  async unblock(blockerUserId: number, blockedUserId: number): Promise<void> {
    await this.prismaService.userBlock.deleteMany({
      where: { blockerUserId, blockedUserId },
    });
  }

  async findBlockedUsers(blockerUserId: number): Promise<BlockedUserRecord[]> {
    const blocks = await this.prismaService.userBlock.findMany({
      where: { blockerUserId },
      select: {
        createdAt: true,
        blocked: {
          select: { id: true, name: true, profilePhoto: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return blocks.map((block) => ({
      userId: block.blocked.id,
      name: block.blocked.name,
      profilePhoto: block.blocked.profilePhoto,
      blockedAt: block.createdAt,
    }));
  }

  async findMutuallyBlockedUserIds(userId: number): Promise<number[]> {
    const blocks = await this.prismaService.userBlock.findMany({
      where: { OR: [{ blockerUserId: userId }, { blockedUserId: userId }] },
      select: { blockerUserId: true, blockedUserId: true },
    });

    return blocks.map((block) =>
      block.blockerUserId === userId
        ? block.blockedUserId
        : block.blockerUserId,
    );
  }

  async hasBlockBetween(
    firstUserId: number,
    secondUserId: number,
  ): Promise<boolean> {
    const block = await this.prismaService.userBlock.findFirst({
      where: {
        OR: [
          { blockerUserId: firstUserId, blockedUserId: secondUserId },
          { blockerUserId: secondUserId, blockedUserId: firstUserId },
        ],
      },
      select: { id: true },
    });

    return block !== null;
  }

  async hasDirectionalBlock(
    blockerUserId: number,
    blockedUserId: number,
  ): Promise<boolean> {
    const block = await this.prismaService.userBlock.findUnique({
      where: { blockerUserId_blockedUserId: { blockerUserId, blockedUserId } },
      select: { id: true },
    });

    return block !== null;
  }

  async hasBlockedMemberInGroup(
    userId: number,
    groupId: number,
  ): Promise<boolean> {
    const block = await this.prismaService.userBlock.findFirst({
      where: {
        OR: [
          {
            blockerUserId: userId,
            blocked: { members: { some: { groupId } } },
          },
          {
            blockedUserId: userId,
            blocker: { members: { some: { groupId } } },
          },
        ],
      },
      select: { id: true },
    });

    return block !== null;
  }
}
