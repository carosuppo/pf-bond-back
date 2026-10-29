import { Transform, Type } from 'class-transformer';
import {
  Allow,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsInt,
  IsNotEmpty,
  IsString,
  MaxLength,
  ValidateIf,
} from 'class-validator';

/**
 * memberIds is the complete desired set of account members when provided.
 * eventId omitted = unchanged, null = remove association, number = set event.
 */
export class UpdateExpenseAccountDto {
  @ValidateIf(
    (_object: UpdateExpenseAccountDto, value: unknown) => value !== undefined,
  )
  @Transform(({ value }: { value: unknown }): unknown =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString({ message: 'El nombre de la cuenta debe ser un texto.' })
  @IsNotEmpty({ message: 'El nombre de la cuenta es obligatorio.' })
  @MaxLength(100, {
    message: 'El nombre de la cuenta no puede superar los 100 caracteres.',
  })
  name?: string;

  @ValidateIf(
    (_object: UpdateExpenseAccountDto, value: unknown) => value !== undefined,
  )
  @IsArray({ message: 'Los miembros deben ser un arreglo.' })
  @ArrayMinSize(1, {
    message: 'La cuenta debe conservar al menos un miembro.',
  })
  @ArrayUnique({ message: 'No puedes repetir miembros en la cuenta.' })
  @IsInt({
    each: true,
    message: 'Cada memberId debe ser un número entero.',
  })
  memberIds?: number[];

  @ValidateIf(
    (_object: UpdateExpenseAccountDto, value: unknown) =>
      value !== undefined && value !== null,
  )
  @Type(() => Number)
  @IsInt({ message: 'El evento debe ser un número entero o null.' })
  eventId?: number | null;

  @Allow()
  groupId?: unknown;
}
