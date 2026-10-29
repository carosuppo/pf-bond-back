import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, RoleEnum } from '@prisma/client';
import { createHash } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import type {
  IAccountDeletionRepository,
  RemovedMembership,
} from './account-deletion.repository.interface';

@Injectable()
export class AccountDeletionPrismaRepository implements IAccountDeletionRepository {
  constructor(private readonly prisma: PrismaService) {}

  async createDeletionRequest(
    userId: number,
    tokenHash: string,
    expiresAt: Date,
    requestedAt: Date,
    cooldownStartedAt: Date,
  ): Promise<boolean> {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        return await this.prisma.$transaction(
          async (tx) => {
            const current = await tx.accountDeletionRequest.findUnique({
              where: { userId },
              select: { createdAt: true, usedAt: true },
            });
            if (
              current &&
              current.usedAt === null &&
              current.createdAt >= cooldownStartedAt
            ) {
              return false;
            }
            await tx.accountDeletionRequest.upsert({
              where: { userId },
              create: { userId, tokenHash, expiresAt, createdAt: requestedAt },
              update: {
                tokenHash,
                expiresAt,
                usedAt: null,
                createdAt: requestedAt,
              },
            });
            return true;
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
        );
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2034' &&
          attempt < 2
        ) {
          continue;
        }
        throw error;
      }
    }
    return false;
  }

  async consumeDeletionRequest(
    tokenHash: string,
    now: Date,
  ): Promise<number | null> {
    const request = await this.prisma.accountDeletionRequest.findUnique({
      where: { tokenHash },
      select: { id: true, userId: true, expiresAt: true, usedAt: true },
    });
    if (!request || request.usedAt || request.expiresAt <= now) return null;

    const consumed = await this.prisma.accountDeletionRequest.updateMany({
      where: { id: request.id, usedAt: null, expiresAt: { gt: now } },
      data: { usedAt: now },
    });
    return consumed.count === 1 ? request.userId : null;
  }

  async cancelDeletionRequest(
    userId: number,
    tokenHash: string,
  ): Promise<void> {
    await this.prisma.accountDeletionRequest.deleteMany({
      where: { userId, tokenHash, usedAt: null },
    });
  }

  async findExpiredUnverifiedUserIds(
    now: Date,
    createdBefore: Date,
  ): Promise<number[]> {
    const users = await this.prisma.user.findMany({
      where: {
        emailVerifiedAt: null,
        createdAt: { lt: createdBefore },
        emailVerificationTokens: {
          none: { usedAt: null, expiresAt: { gt: now } },
        },
      },
      select: { id: true },
    });
    return users.map((user) => user.id);
  }

  async deleteExpiredDeletionRequests(now: Date): Promise<void> {
    await this.prisma.accountDeletionRequest.deleteMany({
      where: {
        OR: [{ expiresAt: { lte: now } }, { usedAt: { not: null } }],
      },
    });
  }

  async deleteAccount(userId: number): Promise<RemovedMembership[]> {
    // Serializable prevents concurrent membership changes from leaving a group
    // without an administrator or creating a member during its removal.
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        return await this.prisma.$transaction(
          async (tx) => {
            const user = await tx.user.findUnique({
              where: { id: userId },
              select: { locationId: true, email: true },
            });
            if (!user) throw new NotFoundException('Usuario no encontrado.');

            const memberships = await tx.member.findMany({
              where: { userId },
              select: { id: true, groupId: true },
              orderBy: { groupId: 'asc' },
            });
            const locationIds = new Set<number>();
            const removedMemberships: RemovedMembership[] = [];
            if (user.locationId !== null) locationIds.add(user.locationId);

            for (const membership of memberships) {
              const members = await tx.member.findMany({
                where: { groupId: membership.groupId },
                select: { id: true, role: true },
                orderBy: { id: 'asc' },
              });
              const remaining = members.filter(
                (member) => member.id !== membership.id,
              );

              if (remaining.length === 0) {
                const events = await tx.event.findMany({
                  where: { groupId: membership.groupId },
                  select: { locationId: true },
                });
                const points = await tx.pointOfInterest.findMany({
                  where: { groupId: membership.groupId },
                  select: { locationId: true },
                });
                for (const event of events) {
                  if (event.locationId !== null)
                    locationIds.add(event.locationId);
                }
                for (const point of points) locationIds.add(point.locationId);

                // EventMember and presence rows cascade from Event and POI.
                await tx.event.deleteMany({
                  where: { groupId: membership.groupId },
                });
                await tx.reminder.deleteMany({
                  where: { groupId: membership.groupId },
                });
                await tx.pointOfInterest.deleteMany({
                  where: { groupId: membership.groupId },
                });
                // Preferences, presences and EventMember rows cascade from Member.
                await tx.member.delete({ where: { id: membership.id } });
                await tx.group.delete({ where: { id: membership.groupId } });
              } else {
                if (
                  !remaining.some((member) => member.role === RoleEnum.ADMIN)
                ) {
                  await tx.member.update({
                    where: { id: remaining[0].id },
                    data: { role: RoleEnum.ADMIN },
                  });
                }
                await tx.member.delete({ where: { id: membership.id } });
                removedMemberships.push({
                  groupId: membership.groupId,
                  memberId: membership.id,
                });
              }
            }

            // Sessions, email verification tokens and push tokens cascade from User.
            const emailHash = createHash('sha256')
              .update(user.email.trim().toLowerCase())
              .digest('hex');
            await tx.securityEvent.deleteMany({
              where: {
                OR: [{ userId }, { identifierHash: emailHash }],
              },
            });
            await tx.securityAlert.deleteMany({
              where: {
                correlationKey: {
                  in: [
                    `AUTH_LOGIN_FAILED:${emailHash}`,
                    `LOCATION_ACCESS_DENIED:user:${userId}`,
                  ],
                },
              },
            });
            await tx.user.delete({ where: { id: userId } });
            if (locationIds.size > 0) {
              await tx.location.deleteMany({
                where: {
                  id: { in: [...locationIds] },
                  user: { is: null },
                  pointOfInterest: { is: null },
                  events: { none: {} },
                },
              });
            }
            return removedMemberships;
          },
          {
            isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
            timeout: 30000,
          },
        );
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2034' &&
          attempt < 2
        )
          continue;
        throw error;
      }
    }
    throw new Error('No se pudo eliminar la cuenta.');
  }
}
