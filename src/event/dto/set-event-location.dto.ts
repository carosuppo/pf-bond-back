import { Type } from 'class-transformer';
import { IsLatitude, IsLongitude } from 'class-validator';

export class SetEventLocationDto {
  @Type(() => Number)
  @IsLatitude({
    message: 'La latitud debe estar entre -90 y 90.',
  })
  latitude!: number;

  @Type(() => Number)
  @IsLongitude({
    message: 'La longitud debe estar entre -180 y 180.',
  })
  longitude!: number;
}
