import type { CreatePointOfInterestDto } from '../dto/create-point-of-interest.dto';
import type { PointOfInterestResponseDto } from '../dto/point-of-interest-response.dto';
import type { CreatePointOfInterestData } from '../interface/create-point-of-interest-data.interface';
import type { PointOfInterestWithLocation } from '../repository/point-of-interest.repository.interface';

export class PointOfInterestMapper {
  static toCreateData(
    dto: CreatePointOfInterestDto,
    groupId: number,
  ): CreatePointOfInterestData {
    const normalizedDescription = dto.description?.trim() ?? '';

    return {
      name: dto.name.trim(),
      description:
        normalizedDescription.length === 0 ? null : normalizedDescription,
      radius: dto.radius,
      latitude: dto.latitude,
      longitude: dto.longitude,
      groupId,
    };
  }

  static toResponse(
    pointOfInterest: PointOfInterestWithLocation,
  ): PointOfInterestResponseDto {
    return {
      id: pointOfInterest.id,
      name: pointOfInterest.name,
      description: pointOfInterest.description,
      radius: pointOfInterest.radius,
      latitude: pointOfInterest.location.latitude,
      longitude: pointOfInterest.location.longitude,
      groupId: pointOfInterest.groupId,
      createdAt: pointOfInterest.createdAt,
    };
  }
}
