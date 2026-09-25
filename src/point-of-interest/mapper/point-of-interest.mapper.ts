import {
  PointOfInterestColor,
  PointOfInterestValidity,
} from '@prisma/client';
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
    now: Date = new Date(),
  ): CreatePointOfInterestData {
    const validity = dto.validity ?? PointOfInterestValidity.PERMANENT;
    const normalizedName = dto.name?.trim() ?? '';

    return {
      color: dto.color ?? PointOfInterestColor.BLUE,
      name: normalizedName.length > 0 ? normalizedName : 'Punto de encuentro',
      radius: dto.radius,
      latitude: dto.latitude,
      longitude: dto.longitude,
      groupId,
      validity,
      endTime: endTimeForValidity(validity, now),
    };
  }

  static toUpdateData(
    dto: UpdatePointOfInterestDto,
  ): UpdatePointOfInterestData {
    const data: UpdatePointOfInterestData = {};

    if (dto.color !== undefined) data.color = dto.color;
    if (dto.name !== undefined) data.name = dto.name.trim();
    if (dto.radius !== undefined) data.radius = dto.radius;
    if (dto.latitude !== undefined) data.latitude = dto.latitude;
    if (dto.longitude !== undefined) data.longitude = dto.longitude;
    if (dto.validity !== undefined) {
      data.validity = dto.validity;
      data.endTime = endTimeForValidity(dto.validity);
    }

    return data;
  }

  static toResponse(
    pointOfInterest: PointOfInterestWithLocation,
  ): PointOfInterestResponseDto {
    return {
      color: pointOfInterest.color,
      id: pointOfInterest.id,
      name: pointOfInterest.name,
      radius: pointOfInterest.radius,
      latitude: pointOfInterest.location.latitude,
      longitude: pointOfInterest.location.longitude,
      groupId: pointOfInterest.groupId,
      createdAt: pointOfInterest.createdAt,
      validity: pointOfInterest.validity,
      endTime: pointOfInterest.endTime,
    };
  }
}

function endTimeForValidity(
  validity: PointOfInterestValidity,
  now: Date = new Date(),
): Date | null {
  const durations = {
    [PointOfInterestValidity.TWELVE_HOURS]: 12 * 60 * 60 * 1000,
    [PointOfInterestValidity.ONE_DAY]: 24 * 60 * 60 * 1000,
    [PointOfInterestValidity.THREE_DAYS]: 3 * 24 * 60 * 60 * 1000,
  } satisfies Partial<Record<PointOfInterestValidity, number>>;
  const duration = durations[validity];
  return duration === undefined ? null : new Date(now.getTime() + duration);
}
