import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';
export class UpdateGroupDto {
  @IsString({ message: 'El nombre debe ser un texto.' })
  @IsNotEmpty({ message: 'El nombre es obligatorio.' })
  name!: string;

  @IsOptional()
  @IsString({ message: 'La imagen del grupo debe ser un texto.' })
  @IsNotEmpty({ message: 'La imagen del grupo no puede estar vacía.' })
  image?: string;

  @IsOptional()
  @IsString({ message: 'La descripción debe ser un texto.' })
  description?: string;

  @IsBoolean({
    message:
      'La obligatoriedad de compartir ubicación debe ser un valor booleano.',
  })
  shareLocationMandatorily!: boolean;
}
