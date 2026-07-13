import { Location, PointOfInterest } from '@prisma/client';

export type PointOfInterestWithLocation = PointOfInterest & {
  location: Location;
};

export interface CreatePointOfInterestPersistence {
  groupId: number;
  createdByUserId: number;
  name: string;
  description?: string;
  radius: number;
  coordinates: string;
}

export interface UpdatePointOfInterestPersistence {
  name?: string;
  description?: string;
  radius?: number;
  coordinates?: string;
}

export interface IPointOfInterestRepository {
  create(
    data: CreatePointOfInterestPersistence,
  ): Promise<PointOfInterestWithLocation>;
  findById(id: number): Promise<PointOfInterestWithLocation | null>;
  findByGroupId(groupId: number): Promise<PointOfInterestWithLocation[]>;
  update(
    id: number,
    data: UpdatePointOfInterestPersistence,
  ): Promise<PointOfInterestWithLocation>;
  softDelete(id: number): Promise<void>;
  isMember(userId: number, groupId: number): Promise<boolean>;
}
