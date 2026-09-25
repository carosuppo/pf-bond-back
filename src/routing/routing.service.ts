import { Inject, Injectable } from '@nestjs/common';

import { PointOfInterestService } from '../point-of-interest/point-of-interest.service';
import type { CalculateRouteDto } from './dto/calculate-route.dto';
import type { RouteResponseDto } from './dto/route-response.dto';
import type { IRoutingProvider } from './routing-provider.interface';

@Injectable()
export class RoutingService {
  constructor(
    private readonly pointOfInterestService: PointOfInterestService,
    @Inject('routingProvider')
    private readonly routingProvider: IRoutingProvider,
  ) {}

  async calculateToPoint(
    groupId: number,
    pointId: number,
    userId: number,
    dto: CalculateRouteDto,
  ): Promise<RouteResponseDto> {
    const point = await this.pointOfInterestService.getActiveForMember(
      groupId,
      pointId,
      userId,
    );

    return this.routingProvider.calculate(
      {
        latitude: dto.originLatitude,
        longitude: dto.originLongitude,
      },
      {
        latitude: point.location.latitude,
        longitude: point.location.longitude,
      },
      dto.mode,
    );
  }
}
