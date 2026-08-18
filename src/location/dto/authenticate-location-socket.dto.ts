import { IsNotEmpty, IsString } from 'class-validator';

export class AuthenticateLocationSocketDto {
  @IsString()
  @IsNotEmpty()
  sessionToken!: string;
}
