import { Injectable } from '@nestjs/common';
import { GroupJoinRequestStatus, RoleEnum } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  GroupJoinRequestRecord,
  GroupJoinRequestResolution,
  GroupJoinRequestSubmission,
  IGroupJoinRequestRepository,
} from './group-join-request.repository.interface';

@Injectable()
export class GroupJoinRequestPrismaRepository implements IGroupJoinRequestRepository {
  constructor(private readonly prisma: PrismaService) {}

  async submit(
    groupId: number,
    userId: number,
  ): Promise<GroupJoinRequestSubmission> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const membership = await tx.member.findFirst({
          where: { groupId, userId },
          select: { id: true },
        });
        if (membership) return { status: 'alreadyMember' };

        const existing = await tx.groupJoinRequest.findUnique({
          where: { groupId_userId: { groupId, userId } },
        });
        if (existing?.status === GroupJoinRequestStatus.PENDING) {
          return { status: 'pending', requestId: existing.id };
        }

        const requestedAt = new Date();
        if (existing) {
          const reopened = await tx.groupJoinRequest.updateMany({
            where: {
              id: existing.id,
              status: { not: GroupJoinRequestStatus.PENDING },
            },
            data: {
              status: GroupJoinRequestStatus.PENDING,
              requestedAt,
              resolvedAt: null,
            },
          });
          return reopened.count === 1
            ? { status: 'created', requestId: existing.id }
            : { status: 'pending', requestId: existing.id };
        }

        const request = await tx.groupJoinRequest.create({
          data: {
            groupId,
            userId,
            status: GroupJoinRequestStatus.PENDING,
            requestedAt,
          },
        });

        return { status: 'created', requestId: request.id };
      });
    } catch (error: unknown) {
      if (!this.isUniqueConstraintError(error)) throw error;
      const existing = await this.prisma.groupJoinRequest.findUnique({
        where: { groupId_userId: { groupId, userId } },
        select: { id: true },
      });
      if (existing) return { status: 'pending', requestId: existing.id };
      throw error;
    }
  }

  async findPendingForAdmin(
    adminUserId: number,
  ): Promise<GroupJoinRequestRecord[]> {
    const requests = await this.prisma.groupJoinRequest.findMany({
      where: {
        status: GroupJoinRequestStatus.PENDING,
        group: {
          deletedAt: null,
          members: { some: { userId: adminUserId, role: RoleEnum.ADMIN } },
        },
      },
      include: {
        group: { select: { name: true } },
        user: { select: { id: true, name: true, profilePhoto: true } },
      },
      orderBy: { requestedAt: 'desc' },
    });

    return requests.map((request) => this.toRecord(request));
  }

  async findAdminUserIds(groupId: number): Promise<number[]> {
    const members = await this.prisma.member.findMany({
      where: { groupId, role: RoleEnum.ADMIN },
      select: { userId: true },
    });
    return members.map((member) => member.userId);
  }

  accept(
    requestId: number,
    adminUserId: number,
  ): Promise<GroupJoinRequestResolution> {
    return this.resolve(
      requestId,
      adminUserId,
      GroupJoinRequestStatus.ACCEPTED,
    );
  }

  reject(
    requestId: number,
    adminUserId: number,
  ): Promise<GroupJoinRequestResolution> {
    return this.resolve(
      requestId,
      adminUserId,
      GroupJoinRequestStatus.REJECTED,
    );
  }

  private async resolve(
    requestId: number,
    adminUserId: number,
    status: 'ACCEPTED' | 'REJECTED',
  ): Promise<GroupJoinRequestResolution> {
    return this.prisma.$transaction(async (tx) => {
      const request = await tx.groupJoinRequest.findUnique({
        where: { id: requestId },
        include: {
          group: { select: { id: true, name: true, deletedAt: true } },
          user: { select: { id: true, name: true } },
        },
      });
      if (!request || request.group.deletedAt) return { status: 'notFound' };
      if (request.status !== GroupJoinRequestStatus.PENDING) {
        return { status: 'notPending' };
      }

      const adminMembership = await tx.member.findFirst({
        where: {
          groupId: request.groupId,
          userId: adminUserId,
          role: RoleEnum.ADMIN,
        },
        select: { id: true },
      });
      if (!adminMembership) return { status: 'forbidden' };

      const updated = await tx.groupJoinRequest.updateMany({
        where: {
          id: requestId,
          status: GroupJoinRequestStatus.PENDING,
        },
        data: { status, resolvedAt: new Date() },
      });
      if (updated.count !== 1) return { status: 'notPending' };

      if (status === GroupJoinRequestStatus.ACCEPTED) {
        const existingMembership = await tx.member.findFirst({
          where: { groupId: request.groupId, userId: request.userId },
          select: { id: true },
        });
        if (!existingMembership) {
          await tx.member.create({
            data: {
              groupId: request.groupId,
              userId: request.userId,
              role: RoleEnum.MEMBER,
            },
          });
        }
      }

      return {
        status: 'resolved',
        groupId: request.groupId,
        groupName: request.group.name,
        requesterUserId: request.user.id,
        requesterName: request.user.name,
      };
    });
  }

  private toRecord(request: {
    id: number;
    groupId: number;
    requestedAt: Date;
    group: { name: string };
    user: { id: number; name: string; profilePhoto: string | null };
  }): GroupJoinRequestRecord {
    return {
      id: request.id,
      groupId: request.groupId,
      groupName: request.group.name,
      requesterUserId: request.user.id,
      requesterName: request.user.name,
      requesterProfilePhoto: request.user.profilePhoto,
      requestedAt: request.requestedAt,
    };
  }

  private isUniqueConstraintError(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 'P2002'
    );
  }
}
