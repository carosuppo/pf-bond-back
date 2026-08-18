import { RoleEnum } from '@prisma/client';

export class GetMemberResponseDto {
  idUser!: number;
  name!: string;
  role!: RoleEnum;
}
