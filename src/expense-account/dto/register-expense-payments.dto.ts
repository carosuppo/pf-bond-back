import { Type } from 'class-transformer';
import { ArrayMinSize, ArrayUnique, IsArray, IsInt } from 'class-validator';

export class RegisterExpensePaymentsDto {
  @IsArray({ message: 'Las participaciones deben enviarse en un arreglo.' })
  @ArrayMinSize(1, {
    message: 'Debes seleccionar al menos una participación.',
  })
  @ArrayUnique({
    message: 'No puedes seleccionar una participación más de una vez.',
  })
  @Type(() => Number)
  @IsInt({
    each: true,
    message: 'Cada identificador de participación debe ser un número entero.',
  })
  expenseShareIds!: number[];
}
