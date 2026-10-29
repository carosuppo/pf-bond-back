import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class ConfirmAccountDeletionDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  token!: string;
}
