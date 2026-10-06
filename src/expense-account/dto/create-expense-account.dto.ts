import { Transform, Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateExpenseAccountDto {
  @Transform(({ value }: { value: unknown }): unknown =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString({
    message: 'El nombre de la cuenta debe ser un texto.',
  })
  @IsNotEmpty({
    message: 'El nombre de la cuenta es obligatorio.',
  })
  @MaxLength(100, {
    message: 'El nombre de la cuenta no puede superar los 100 caracteres.',
  })
  name!: string;

  @IsArray({
    message: 'Los miembros deben ser un arreglo.',
  })
  @ArrayMinSize(1, {
    message: 'Debes asociar al menos un miembro a la cuenta.',
  })
  @IsInt({
    each: true,
    message: 'Cada memberId debe ser un número entero.',
  })
  memberIds!: number[];

  @Type(() => Number)
  @IsInt({
    message: 'El evento debe ser un número entero.',
  })
  @IsOptional()
  eventId?: number | null;
}
