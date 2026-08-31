import { Type } from 'class-transformer';
import {
  IsLatitude,
  IsLongitude,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class CreatePointOfInterestDto {
  @IsString({ message: 'El nombre debe ser un texto.' })
  @IsNotEmpty({ message: 'El nombre es obligatorio.' })
  @MaxLength(100, {
    message: 'El nombre no puede superar los 100 caracteres.',
  })
  name!: string;

  @IsOptional()
  @IsString({ message: 'La descripción debe ser un texto.' })
  @MaxLength(500, {
    message: 'La descripción no puede superar los 500 caracteres.',
  })
  description?: string;

  @Type(() => Number)
  @IsNumber({}, { message: 'El radio debe ser un número.' })
  @Min(1, {
    message: 'El radio debe ser mayor o igual a 1 metro.',
  })
  radius!: number;

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
