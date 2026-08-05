import { Member, Prisma } from '@prisma/client';
import { AddMemberData } from '../interface/add-member.interface';

export interface IMemberRepository {
  addMember(
    addMemberData: AddMemberData,
    tx?: Prisma.TransactionClient,
  ): Promise<Member>;
  findByUserAndGroup(userId: number, groupId: number): Promise<Member | null>;
}
