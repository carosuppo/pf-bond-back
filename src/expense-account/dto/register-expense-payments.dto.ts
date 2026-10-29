import { Type } from 'class-transformer';
import { ArrayUnique, IsArray, IsInt, IsOptional } from 'class-validator';

export class RegisterExpensePaymentsDto {
  @IsOptional()
  @IsArray({ message: 'Las participaciones deben enviarse en un arreglo.' })
  @ArrayUnique({
    message: 'No puedes seleccionar una participación más de una vez.',
  })
  @Type(() => Number)
  @IsInt({
    each: true,
    message: 'Cada identificador de participación debe ser un número entero.',
  })
  expenseShareIds?: number[];

  @IsOptional()
  @IsArray({ message: 'Los ajustes deben enviarse en un arreglo.' })
  @ArrayUnique({
    message: 'No puedes seleccionar un ajuste más de una vez.',
  })
  @Type(() => Number)
  @IsInt({
    each: true,
    message: 'Cada identificador de ajuste debe ser un número entero.',
  })
  adjustmentIds?: number[];
}
