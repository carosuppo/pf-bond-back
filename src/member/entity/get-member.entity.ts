import { RoleEnum } from '@prisma/client';

export interface GetMemberEntity {
  idUser: number;
  name: string;
  role: RoleEnum;
}
