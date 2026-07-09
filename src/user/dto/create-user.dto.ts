import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  Matches,
} from 'class-validator';

export class CreateUserDto {
  @IsString()
  @IsNotEmpty()
  @Length(2, 100)
  // Acá se podría usar un decorador @IsAlphanumeric() pero no permitiría espacios, acentos ni letras ñ
  @Matches(/^[A-Za-zÁÉÍÓÚáéíóúÑñÜü\s'-]+$/, {
    message:
      'Sólo se permiten carácteres alfabéticos, espacios, guiones y apóstrofes para el nombre',
  })
  name!: string;

  @IsEmail()
  @IsNotEmpty()
  email!: string;

  @IsOptional()
  @IsString()
  @Length(8, 30)
  @Matches(/^\+?[0-9\s()-]+$/, {
    message: 'Sólo se permiten carácteres válidos para números de teléfono',
  })
  phone?: string;

  @IsString()
  @IsNotEmpty()
  @Length(8, 16)
  password!: string;
}
