import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  Matches,
} from 'class-validator';

export class UpdateUserDto {
  @IsOptional()
  @IsString({ message: 'El nombre debe ser un texto.' })
  @IsNotEmpty({ message: 'El nombre no puede estar vacío.' })
  @Length(2, 100, {
    message: 'El nombre debe tener entre 2 y 100 caracteres.',
  })
  @Matches(/^[A-Za-zÁÉÍÓÚáéíóúÑñÜü\s'-]+$/, {
    message:
      'Sólo se permiten carácteres alfabéticos, espacios, guiones y apóstrofes para el nombre',
  })
  name?: string;

  @IsOptional()
  @IsEmail({}, { message: 'El formato del correo electrónico es inválido.' })
  email?: string;
}
