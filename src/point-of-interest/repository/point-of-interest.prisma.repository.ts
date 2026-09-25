import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';
import type { CreatePointOfInterestData } from '../interface/create-point-of-interest-data.interface';
import type { UpdatePointOfInterestData } from '../interface/update-point-of-interest-data.interface';
import type {
  IPointOfInterestRepository,
  PointOfInterestWithLocation,
} from './point-of-interest.repository.interface';

@Injectable()
export class PointOfInterestPrismaRepository implements IPointOfInterestRepository {
  constructor(private readonly prismaService: PrismaService) {}

  async create(
    data: CreatePointOfInterestData,
  ): Promise<PointOfInterestWithLocation> {
    return this.prismaService.$transaction(async (transaction) => {
      const location = await transaction.location.create({
        data: {
          latitude: data.latitude,
          longitude: data.longitude,
        },
      });

      return transaction.pointOfInterest.create({
        data: {
          color: data.color,
          name: data.name,
          radius: data.radius,
          validity: data.validity,
          endTime: data.endTime,
          groupId: data.groupId,
          locationId: location.id,
        },
        include: {
          location: true,
        },
      });
    });
  }

  async findByGroupId(groupId: number): Promise<PointOfInterestWithLocation[]> {
    const now = new Date();
    return this.prismaService.$transaction(async (transaction) => {
      await transaction.pointOfInterestPresence.deleteMany({
        where: {
          pointOfInterest: {
            groupId,
            validity: { not: 'PERMANENT' },
            endTime: { lte: now },
          },
        },
      });

      return transaction.pointOfInterest.findMany({
        where: {
          groupId,
          deletedAt: null,
          OR: [
            { validity: 'PERMANENT' },
            { validity: { not: 'PERMANENT' }, endTime: { gt: now } },
          ],
        },
        include: {
          location: true,
        },
        orderBy: {
          createdAt: 'asc',
        },
      });
    });
  }

  async findByIdAndGroupId(
    pointId: number,
    groupId: number,
  ): Promise<PointOfInterestWithLocation | null> {
    return this.prismaService.pointOfInterest.findFirst({
      where: { id: pointId, groupId, deletedAt: null },
      include: { location: true },
    });
  }

  async findActiveByIdAndGroupId(
    pointId: number,
    groupId: number,
  ): Promise<PointOfInterestWithLocation | null> {
    return this.prismaService.pointOfInterest.findFirst({
      where: {
        id: pointId,
        groupId,
        deletedAt: null,
        OR: [
            { validity: 'PERMANENT' },
            { validity: { not: 'PERMANENT' }, endTime: { gt: new Date() } },
        ],
      },
      include: { location: true },
    });
  }

  async update(
    pointId: number,
    data: UpdatePointOfInterestData,
  ): Promise<PointOfInterestWithLocation> {
    return this.prismaService.$transaction(async (transaction) => {
      await transaction.$queryRaw`SELECT id FROM "PointOfInterest" WHERE id = ${pointId} FOR UPDATE`;
      const point = await transaction.pointOfInterest.findUniqueOrThrow({
        where: { id: pointId },
        include: { location: true },
      });

      const geometryChanged =
        (data.radius !== undefined && data.radius !== point.radius) ||
        (data.latitude !== undefined &&
          data.latitude !== point.location.latitude) ||
        (data.longitude !== undefined &&
          data.longitude !== point.location.longitude);
      if (geometryChanged) {
        await transaction.pointOfInterestPresence.deleteMany({
          where: { pointOfInterestId: pointId },
        });
      }
      if (data.latitude !== undefined || data.longitude !== undefined) {
        await transaction.location.update({
          where: { id: point.locationId },
          data: {
            latitude: data.latitude,
            longitude: data.longitude,
          },
        });
      }

      return transaction.pointOfInterest.update({
        where: { id: pointId },
        data: {
          color: data.color,
          name: data.name,
          radius: data.radius,
          validity: data.validity,
          endTime: data.endTime,
        },
        include: { location: true },
      });
    });
  }

  async softDelete(pointId: number): Promise<void> {
    await this.prismaService.$transaction(async (tx) => {
      await tx.pointOfInterest.update({
        where: { id: pointId },
        data: { deletedAt: new Date() },
      });
      await tx.pointOfInterestPresence.deleteMany({
        where: { pointOfInterestId: pointId },
      });
    });
  }
}
