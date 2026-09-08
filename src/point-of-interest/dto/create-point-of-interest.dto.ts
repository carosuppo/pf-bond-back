import { PointOfInterestColor } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  IsEnum,
  ValidateIf,
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
  @ValidateIf((_object: unknown, value: unknown) => value !== undefined)
  @IsEnum(PointOfInterestColor)
  color?: PointOfInterestColor;

  @Transform(({ value }: { value: unknown }): unknown =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString({ message: 'El nombre debe ser un texto.' })
  @IsNotEmpty({ message: 'El nombre es obligatorio.' })
  @MaxLength(100, {
    message: 'El nombre no puede superar los 100 caracteres.',
  })
  name!: string;

  @IsOptional()
  @Transform(({ value }: { value: unknown }): unknown =>
    typeof value === 'string' && value.trim().length === 0
      ? null
      : typeof value === 'string'
        ? value.trim()
        : value,
  )
  @IsString({ message: 'La descripción debe ser un texto.' })
  @MaxLength(500, {
    message: 'La descripción no puede superar los 500 caracteres.',
  })
  description?: string;

  @Type(() => Number)
  @IsNumber({}, { message: 'El radio debe ser un número.' })
  @Min(0.000001, {
    message: 'El radio debe ser mayor a 0.',
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
