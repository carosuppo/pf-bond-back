import { RoleEnum } from '@prisma/client';

export class GetMemberResponseDto {
  id!: number;
  idUser!: number;
  name!: string;
  profilePhoto!: string | null;
  role!: RoleEnum;
}
