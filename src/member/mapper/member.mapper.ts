import { RoleEnum } from '@prisma/client';
import { AddMemberDto } from '../dto/add-member.dto';
import { GetMemberInfoResponseDto } from '../dto/get-member-info-response.dto';
import { GetMemberInfoEntity } from '../entity/get-member-info.entity';
import { AddMemberData } from '../interface/add-member.interface';
export class MemberMapper {
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

  static toGetMemberInfoResponse(
    entity: GetMemberInfoEntity,
  ): GetMemberInfoResponseDto {
    return {
      memberId: entity.memberId,
      name: entity.name,
      lastSeenAt: entity.lastSeenAt,
    };
  }
}
