import { IsNotEmpty, IsString } from 'class-validator';

export class JoinGroupDto {
  @IsString({
    message: 'El código de invitación debe ser un texto.',
  })
  @IsNotEmpty({
    message: 'El código de invitación es obligatorio.',
  })
  invitationCode!: string;
}
