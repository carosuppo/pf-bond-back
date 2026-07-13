import { Location, PointOfInterest } from '@prisma/client';
import { PointOfInterestResponseDto } from '../dto/point-of-interest-response.dto';

type PointOfInterestWithLocation = PointOfInterest & { location: Location };

export class PointOfInterestMapper {
  static toResponse(
    entity: PointOfInterestWithLocation,
  ): PointOfInterestResponseDto {
    const [latitude, longitude] = entity.location.coordinates
      .split(',')
      .map(Number);

    return {
      id: entity.id,
      groupId: entity.groupId,
      name: entity.name,
      description: entity.description,
      latitude,
      longitude,
      radius: entity.radius,
      createdByUserId: entity.createdByUserId,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    };
  }
}
