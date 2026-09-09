import { PointOfInterestColor } from '@prisma/client';
import type { CreatePointOfInterestDto } from '../dto/create-point-of-interest.dto';
import type { PointOfInterestResponseDto } from '../dto/point-of-interest-response.dto';
import type { UpdatePointOfInterestDto } from '../dto/update-point-of-interest.dto';
import type { CreatePointOfInterestData } from '../interface/create-point-of-interest-data.interface';
import type { UpdatePointOfInterestData } from '../interface/update-point-of-interest-data.interface';
import type { PointOfInterestWithLocation } from '../repository/point-of-interest.repository.interface';

export class PointOfInterestMapper {
  static toCreateData(
    dto: CreatePointOfInterestDto,
    groupId: number,
  ): CreatePointOfInterestData {
    const normalizedDescription = dto.description?.trim() ?? '';

    return {
      color: dto.color ?? PointOfInterestColor.BLUE,
      name: dto.name.trim(),
      description:
        normalizedDescription.length === 0 ? null : normalizedDescription,
      radius: dto.radius,
      latitude: dto.latitude,
      longitude: dto.longitude,
      groupId,
    };
  }

  static toUpdateData(
    dto: UpdatePointOfInterestDto,
  ): UpdatePointOfInterestData {
    const data: UpdatePointOfInterestData = {};

    if (dto.color !== undefined) data.color = dto.color;
    if (dto.name !== undefined) data.name = dto.name.trim();
    if (dto.description !== undefined) {
      const description = dto.description?.trim() ?? '';
      data.description = description.length === 0 ? null : description;
    }
    if (dto.radius !== undefined) data.radius = dto.radius;
    if (dto.latitude !== undefined) data.latitude = dto.latitude;
    if (dto.longitude !== undefined) data.longitude = dto.longitude;

    return data;
  }

  static toResponse(
    pointOfInterest: PointOfInterestWithLocation,
  ): PointOfInterestResponseDto {
    return {
      color: pointOfInterest.color,
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
