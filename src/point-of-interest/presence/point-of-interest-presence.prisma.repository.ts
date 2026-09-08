import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  IPointOfInterestPresenceRepository,
  PresenceCandidate,
} from './point-of-interest-presence.repository.interface';

@Injectable()
export class PointOfInterestPresencePrismaRepository implements IPointOfInterestPresenceRepository {
  constructor(private readonly prisma: PrismaService) {}
  async findCandidates(userId: number): Promise<PresenceCandidate[]> {
    const members = await this.prisma.member.findMany({
      where: {
        userId,
        user: { deletedAt: null },
        group: { deletedAt: null },
        OR: [
          { locationSharingEnabled: true },
          { group: { shareLocationMandatorily: true } },
        ],
      },
      include: {
        pointOfInterestPresences: true,
        group: {
          include: {
            pointsOfInterest: {
              where: { deletedAt: null },
              include: { location: true },
            },
          },
        },
      },
    });
    return members.flatMap((member) =>
      member.group.pointsOfInterest.map((point) => {
        const presence = member.pointOfInterestPresences.find(
          (item) => item.pointOfInterestId === point.id,
        );
        return {
          memberId: member.id,
          groupId: member.groupId,
          pointOfInterestId: point.id,
          name: point.name,
          radius: point.radius,
          latitude: point.location.latitude,
          longitude: point.location.longitude,
          isInside: presence?.isInside ?? null,
          presenceId: presence?.id ?? null,
          geometryUpdatedAt: point.updatedAt,
        };
      }),
    );
  }
  async save(
    candidate: PresenceCandidate,
    isInside: boolean,
  ): Promise<boolean> {
    return this.prisma.$transaction(async (tx) => {
      // Lock group, member and POI in this order; reset paths use the same order.
      await tx.$queryRaw`SELECT id FROM "Group" WHERE id = ${candidate.groupId} FOR UPDATE`;
      await tx.$queryRaw`SELECT id FROM "Member" WHERE id = ${candidate.memberId} FOR UPDATE`;
      await tx.$queryRaw`SELECT id FROM "PointOfInterest" WHERE id = ${candidate.pointOfInterestId} FOR UPDATE`;
      const member = await tx.member.findFirst({
        where: {
          id: candidate.memberId,
          user: { deletedAt: null },
          group: { deletedAt: null },
          OR: [
            { locationSharingEnabled: true },
            { group: { shareLocationMandatorily: true } },
          ],
        },
        select: { id: true },
      });
      const point = await tx.pointOfInterest.findFirst({
        where: {
          id: candidate.pointOfInterestId,
          deletedAt: null,
          updatedAt: candidate.geometryUpdatedAt,
        },
        select: { id: true },
      });
      if (!member || !point) return false;
      if (candidate.isInside === null) {
        await tx.pointOfInterestPresence.createMany({
          data: {
            memberId: candidate.memberId,
            pointOfInterestId: candidate.pointOfInterestId,
            isInside,
          },
          skipDuplicates: true,
        });
        return false;
      }
      // The id prevents a stale observation from resurrecting a deleted baseline.
      const result = await tx.pointOfInterestPresence.updateMany({
        where: { id: candidate.presenceId!, isInside: candidate.isInside },
        data: { isInside },
      });
      return result.count === 1;
    });
  }
}
