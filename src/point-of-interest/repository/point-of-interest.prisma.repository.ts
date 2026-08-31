import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';
import type { CreatePointOfInterestData } from '../interface/create-point-of-interest-data.interface';
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
          name: data.name,
          description: data.description,
          radius: data.radius,
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
    return this.prismaService.pointOfInterest.findMany({
      where: {
        groupId,
        deletedAt: null,
      },
      include: {
        location: true,
      },
      orderBy: {
        createdAt: 'asc',
      },
    });
  }
}
