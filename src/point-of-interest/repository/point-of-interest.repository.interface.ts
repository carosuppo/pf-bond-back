import { Prisma } from '@prisma/client';

import type { CreatePointOfInterestData } from '../interface/create-point-of-interest-data.interface';
import type { UpdatePointOfInterestData } from '../interface/update-point-of-interest-data.interface';

export type PointOfInterestWithLocation = Prisma.PointOfInterestGetPayload<{
  include: {
    location: true;
  };
}>;

export interface IPointOfInterestRepository {
  create(data: CreatePointOfInterestData): Promise<PointOfInterestWithLocation>;

  findByGroupId(groupId: number): Promise<PointOfInterestWithLocation[]>;

  findByIdAndGroupId(
    pointId: number,
    groupId: number,
  ): Promise<PointOfInterestWithLocation | null>;

  update(
    pointId: number,
    data: UpdatePointOfInterestData,
  ): Promise<PointOfInterestWithLocation>;

  softDelete(pointId: number): Promise<void>;
}
