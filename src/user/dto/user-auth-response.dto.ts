import { UserResponseDto } from './user-response.dto';

export class UserAuthResponseDto {
  sessionToken!: string;
  expiresAt!: Date;
  user!: UserResponseDto;
}
