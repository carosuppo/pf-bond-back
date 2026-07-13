import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreatePointOfInterestPersistence,
  IPointOfInterestRepository,
  PointOfInterestWithLocation,
  UpdatePointOfInterestPersistence,
} from './point-of-interest.repository.interface';

@Injectable()
export class PointOfInterestPrismaRepository
  implements IPointOfInterestRepository
{
  constructor(private readonly prisma: PrismaService) {}

  async create(
    data: CreatePointOfInterestPersistence,
  ): Promise<PointOfInterestWithLocation> {
    return this.prisma.pointOfInterest.create({
      data: {
        name: data.name,
        description: data.description,
        radius: data.radius,
        group: { connect: { id: data.groupId } },
        createdBy: { connect: { id: data.createdByUserId } },
        location: { create: { coordinates: data.coordinates } },
      },
      include: { location: true },
    });
  }

  async findById(id: number): Promise<PointOfInterestWithLocation | null> {
    return this.prisma.pointOfInterest.findFirst({
      where: { id, deletedAt: null },
      include: { location: true },
    });
  }

  async findByGroupId(groupId: number): Promise<PointOfInterestWithLocation[]> {
    return this.prisma.pointOfInterest.findMany({
      where: { groupId, deletedAt: null },
      include: { location: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async update(
    id: number,
    data: UpdatePointOfInterestPersistence,
  ): Promise<PointOfInterestWithLocation> {
    return this.prisma.pointOfInterest.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.description !== undefined && {
          description: data.description,
        }),
        ...(data.radius !== undefined && { radius: data.radius }),
        ...(data.coordinates !== undefined && {
          location: { update: { coordinates: data.coordinates } },
        }),
      },
      include: { location: true },
    });
  }

  async softDelete(id: number): Promise<void> {
    await this.prisma.pointOfInterest.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  async isMember(userId: number, groupId: number): Promise<boolean> {
    const member = await this.prisma.member.findUnique({
      where: { userId_groupId: { userId, groupId } },
    });
    return member !== null;
  }
}
