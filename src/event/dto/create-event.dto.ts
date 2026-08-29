import { Type } from 'class-transformer';
import {
  IsArray,
  IsDate,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';
import { IsAfter } from '../../common/validators/after-date.validator';
import { IsFutureDate } from '../../common/validators/future-date.validator';

export class CreateEventDto {
  @IsString({
    message: 'El nombre del evento debe ser un texto.',
  })
  @IsNotEmpty({
    message: 'El nombre del evento es obligatorio.',
  })
  name!: string;

  @IsString({
    message: 'La descripción debe ser un texto.',
  })
  @IsOptional()
  description?: string;

  @Type(() => Date)
  @IsDate({
    message: 'startAt debe ser una fecha.',
  })
  @IsNotEmpty({
    message: 'El startAt es obligatorio.',
  })
  @IsFutureDate({ message: 'La startAt debe ser posterior a la fecha actual.' })
  startAt!: Date;

  @Type(() => Date)
  @IsDate({
    message: 'endAt debe ser una fecha.',
  })
  @IsAfter('startAt', {
    message: 'El endAt debe ser posterior al startAt.',
  })
  @IsOptional()
  endAt?: Date;

  @IsArray({
    message: 'Los miembros deben ser un arreglo.',
  })
  @IsInt({
    each: true,
    message: 'Cada memberId debe ser un número entero.',
  })
  memberIds!: number[];
}
