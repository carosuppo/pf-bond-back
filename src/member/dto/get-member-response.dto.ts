import { RoleEnum } from '@prisma/client';

export class GetMemberResponseDto {
  id!: number;
  idUser!: number;
  name!: string;
  role!: RoleEnum;
}
