import { RoleEnum } from '@prisma/client';

export interface GetMemberEntity {
  id: number;
  name: string;
  role: RoleEnum;
  idUser: number;
}
