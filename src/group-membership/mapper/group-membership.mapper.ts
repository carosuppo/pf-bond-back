import { RoleEnum } from '@prisma/client';
import { AddMemberDto } from '../dto/add-member.dto';
import { AddMemberData } from '../interface/add-member.interface';
export class GroupMembershipMapper {
  static toAddMemberData(
    addMemberDto: AddMemberDto,
    role: RoleEnum,
  ): AddMemberData {
    return {
      groupId: addMemberDto.groupId,
      userId: addMemberDto.userId,
      role,
    };
  }
}
