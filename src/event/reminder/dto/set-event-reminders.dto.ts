import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsOptional,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

export class EventReminderItemDto {
  @IsInt({
    message: 'Cada anticipación debe ser un número entero de minutos.',
  })
  @Min(1, {
    message: 'La anticipación mínima es de 1 minuto.',
  })
  @Max(40320, {
    message: 'La anticipación máxima es de 4 semanas (40320 minutos).',
  })
  leadMinutes!: number;

  @IsInt({
    message: 'El desfase horario debe ser un número entero de minutos.',
  })
  @Min(-720, {
    message: 'El desfase horario mínimo es de -720 minutos.',
  })
  @Max(840, {
    message: 'El desfase horario máximo es de 840 minutos.',
  })
  @IsOptional()
  utcOffsetMinutes?: number;
}

export class SetEventRemindersDto {
  @IsArray({
    message: 'Los recordatorios deben ser un arreglo.',
  })
  @ArrayMaxSize(8, {
    message: 'Se permite un máximo de 8 recordatorios por evento.',
  })
  @ValidateNested({
    each: true,
    message: 'Cada recordatorio debe indicar leadMinutes.',
  })
  @Type(() => EventReminderItemDto)
  reminders!: EventReminderItemDto[];
}
