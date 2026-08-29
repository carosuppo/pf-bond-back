import { RoleEnum } from '@prisma/client';

export class GetMemberResponseDto {
  id!: number;
  name!: string;
  role!: RoleEnum;
  idUser!: number;
}
