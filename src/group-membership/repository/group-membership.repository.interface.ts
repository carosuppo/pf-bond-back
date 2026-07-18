import { Member, Prisma } from '@prisma/client';
import { AddMemberData } from '../interface/add-member.interface';

export interface IGroupMembershipRepository {
  addMember(
    addMemberData: AddMemberData,
    prisma?: Prisma.TransactionClient,
  ): Promise<Member>;
}
