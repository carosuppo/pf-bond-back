import { Type } from 'class-transformer';
import { IsDate, IsEnum, IsOptional } from 'class-validator';
import { EventRecurrenceFrequency } from '@prisma/client';

export class EventRecurrenceDto {
  @IsEnum(EventRecurrenceFrequency, {
    message: 'La periodicidad debe ser DAILY, WEEKLY o MONTHLY.',
  })
  frequency!: EventRecurrenceFrequency;

  @IsOptional()
  @Type(() => Date)
  @IsDate({ message: 'La fecha final de la recurrencia debe ser válida.' })
  until?: Date | null;
}
