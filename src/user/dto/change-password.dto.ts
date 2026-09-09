import { IsNotEmpty, IsString, Length } from 'class-validator';

export class ChangePasswordDto {
  @IsString({ message: 'La contraseña actual debe ser un texto.' })
  @IsNotEmpty({ message: 'La contraseña actual no puede estar vacía.' })
  @Length(8, 16, {
    message: 'La contraseña actual debe tener entre 8 y 16 caracteres.',
  })
  currentPassword!: string;

  @IsString({ message: 'La nueva contraseña debe ser un texto.' })
  @IsNotEmpty({ message: 'La nueva contraseña no puede estar vacía.' })
  @Length(8, 16, {
    message: 'La nueva contraseña debe tener entre 8 y 16 caracteres.',
  })
  newPassword!: string;
}
