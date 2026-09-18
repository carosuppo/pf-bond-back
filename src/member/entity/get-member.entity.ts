import { RoleEnum } from '@prisma/client';

export interface GetMemberEntity {
  id: number;
  idUser: number;
  name: string;
  profilePhoto: string | null;
  role: RoleEnum;
}
