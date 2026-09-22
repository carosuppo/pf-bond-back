import { RouteMode } from './dto/route-mode';
import type { RouteResponseDto } from './dto/route-response.dto';

export interface RouteCoordinates {
  latitude: number;
  longitude: number;
}

export interface IRoutingProvider {
  calculate(
    origin: RouteCoordinates,
    destination: RouteCoordinates,
    mode: RouteMode,
  ): Promise<RouteResponseDto>;
}
