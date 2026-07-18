import { RoleEnum } from '@prisma/client';

export interface AddMemberData {
  groupId: number;
  userId: number;
  role: RoleEnum;
}
