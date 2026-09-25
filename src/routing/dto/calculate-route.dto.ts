import { Type } from 'class-transformer';
import { IsEnum, IsLatitude, IsLongitude } from 'class-validator';

import { RouteMode } from './route-mode';

export class CalculateRouteDto {
  @Type(() => Number)
  @IsLatitude({ message: 'La latitud de origen debe estar entre -90 y 90.' })
  originLatitude!: number;

  @Type(() => Number)
  @IsLongitude({
    message: 'La longitud de origen debe estar entre -180 y 180.',
  })
  originLongitude!: number;

  @IsEnum(RouteMode, { message: 'El modo debe ser DRIVING o WALKING.' })
  mode!: RouteMode;
}
