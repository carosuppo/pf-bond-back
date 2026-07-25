import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateGroupDto {
  @IsString({
    message: 'El nombre del grupo debe ser un texto.',
  })
  @IsNotEmpty({
    message: 'El nombre del grupo es obligatorio.',
  })
  name!: string;

  @IsString({
    message: 'La descripción debe ser un texto.',
  })
  @IsOptional()
  description?: string;

  @IsBoolean({
    message: 'shareLocationMandatorily debe ser un valor booleano.',
  })
  @IsOptional()
  shareLocationMandatorily!: boolean;
}
