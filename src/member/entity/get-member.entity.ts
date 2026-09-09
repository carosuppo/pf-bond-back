import { RoleEnum } from '@prisma/client';

export interface GetMemberEntity {
  id: number;
  idUser: number;
  name: string;
  role: RoleEnum;
}
