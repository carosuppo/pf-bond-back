import { Type } from 'class-transformer';
import {
  IsArray,
  IsDate,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';
import { IsFutureDate } from '../../common/validators/future-date.validator';

export class UpdateEventDto {
  @IsOptional()
  @IsString({
    message: 'El nombre del evento debe ser un texto.',
  })
  @IsNotEmpty({
    message: 'El nombre del evento no puede estar vacío.',
  })
  name?: string;

  @IsOptional()
  @IsString({
    message: 'La descripción debe ser un texto.',
  })
  description?: string | null;

  @Type(() => Date)
  @IsOptional()
  @IsDate({
    message: 'startAt debe ser una fecha.',
  })
  @IsFutureDate({ message: 'La startAt debe ser posterior a la fecha actual.' })
  startAt?: Date;

  @Type(() => Date)
  @IsOptional()
  @IsDate({
    message: 'endAt debe ser una fecha.',
  })
  endAt?: Date | null;

  @IsOptional()
  @IsArray({
    message: 'Los miembros deben ser un arreglo.',
  })
  @IsInt({
    each: true,
    message: 'Cada memberId debe ser un número entero.',
  })
  memberIds?: number[];
}
