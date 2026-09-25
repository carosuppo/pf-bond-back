import { PointOfInterestColor, PointOfInterestValidity } from '@prisma/client';
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

export class UpdatePointOfInterestDto {
  @ValidateIf((_object: unknown, value: unknown) => value !== undefined)
  @IsEnum(PointOfInterestColor)
  color?: PointOfInterestColor;

  @IsOptional()
  @Transform(({ value }: { value: unknown }): unknown =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString({ message: 'El nombre debe ser un texto.' })
  @IsNotEmpty({ message: 'El nombre no puede estar vacío.' })
  @MaxLength(100, {
    message: 'El nombre no puede superar los 100 caracteres.',
  })
  name?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'El radio debe ser un número.' })
  @Min(0.000001, { message: 'El radio debe ser mayor a 0.' })
  radius?: number;

  @IsOptional()
  @Type(() => Number)
  @IsLatitude({ message: 'La latitud debe estar entre -90 y 90.' })
  latitude?: number;

  @IsOptional()
  @Type(() => Number)
  @IsLongitude({ message: 'La longitud debe estar entre -180 y 180.' })
  longitude?: number;

  @IsOptional()
  @IsEnum(PointOfInterestValidity, {
    message: 'La vigencia seleccionada no es válida.',
  })
  validity?: PointOfInterestValidity;
}
