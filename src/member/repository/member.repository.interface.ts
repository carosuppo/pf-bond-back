import { Member, Prisma, RoleEnum } from '@prisma/client';
import { GetMemberInfoEntity } from '../entity/get-member-info.entity';
import { AddMemberData } from '../interface/add-member.interface';

export interface IMemberRepository {
  addMember(
    addMemberData: AddMemberData,
    tx?: Prisma.TransactionClient,
  ): Promise<Member>;
  findByUserAndGroup(userId: number, groupId: number): Promise<Member | null>;
  findByIdWithUser(memberId: number): Promise<GetMemberInfoEntity | null>;
  findById(memberId: number): Promise<Member | null>;
  countAdminsByGroup(groupId: number): Promise<number>;
  updateRole(memberId: number, role: RoleEnum): Promise<Member>;
}
