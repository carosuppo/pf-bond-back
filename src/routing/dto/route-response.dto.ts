export class RoutePointDto {
  latitude!: number;
  longitude!: number;
}

export class RouteResponseDto {
  points!: RoutePointDto[];
  distanceMeters!: number;
  durationSeconds!: number;
}
