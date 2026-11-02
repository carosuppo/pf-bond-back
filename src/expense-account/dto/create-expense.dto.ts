import { ExpenseSplitType } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

export class ExpenseShareDto {
  @Type(() => Number)
  @IsInt({
    message: 'Cada memberId del reparto debe ser un número entero.',
  })
  memberId!: number;

  @Type(() => Number)
  @IsInt({
    message: 'Cada importe del reparto debe ser un número entero.',
  })
  @Min(0, {
    message: 'Cada importe del reparto debe ser mayor o igual a cero.',
  })
  amountCents!: number;
}

export class CreateExpenseDto {
  @Transform(({ value }: { value: unknown }): unknown =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString({
    message: 'El título del gasto debe ser un texto.',
  })
  @MaxLength(100, {
    message: 'El título del gasto no puede superar los 100 caracteres.',
  })
  @IsOptional()
  title?: string;

  @Type(() => Number)
  @IsInt({
    message: 'El importe debe ser un número entero.',
  })
  @Min(1, {
    message: 'El importe debe ser mayor que cero.',
  })
  amountCents!: number;

  @Type(() => Number)
  @IsInt({
    message: 'El pagador debe ser un número entero.',
  })
  @IsNotEmpty({
    message: 'Debes indicar qué miembro realizó el pago.',
  })
  payerMemberId!: number;

  @IsEnum(ExpenseSplitType, {
    message: 'El tipo de reparto no es válido.',
  })
  splitType!: ExpenseSplitType;

  @ValidateIf((object: CreateExpenseDto) => object.splitType === 'EQUAL')
  @IsArray({
    message: 'Los participantes deben ser un arreglo.',
  })
  @ArrayMinSize(1, {
    message: 'Debes indicar al menos un participante del gasto.',
  })
  @IsInt({
    each: true,
    message: 'Cada participante debe ser un número entero.',
  })
  participantIds?: number[];

  @ValidateIf((object: CreateExpenseDto) => object.splitType === 'CUSTOM')
  @IsArray({
    message: 'El reparto debe ser un arreglo.',
  })
  @ArrayMinSize(1, {
    message: 'Debes indicar al menos un importe en el reparto.',
  })
  @ValidateNested({ each: true })
  @Type(() => ExpenseShareDto)
  shares?: ExpenseShareDto[];
}
