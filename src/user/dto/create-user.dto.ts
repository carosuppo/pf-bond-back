import {
  IsEmail,
  IsDateString,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  Matches,
} from 'class-validator';
import { TERMS_OF_USE_VERSION } from '../constants/terms-of-use.constants';

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

  @IsDateString({ strict: true })
  @IsNotEmpty()
  birthDate!: string;

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

  @IsString()
  @IsIn([TERMS_OF_USE_VERSION])
  termsVersion!: string;
}
