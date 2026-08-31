import { Prisma } from '@prisma/client';

import type { CreatePointOfInterestData } from '../interface/create-point-of-interest-data.interface';

export type PointOfInterestWithLocation = Prisma.PointOfInterestGetPayload<{
  include: {
    location: true;
  };
}>;

export interface IPointOfInterestRepository {
  create(data: CreatePointOfInterestData): Promise<PointOfInterestWithLocation>;

  findByGroupId(groupId: number): Promise<PointOfInterestWithLocation[]>;
}
