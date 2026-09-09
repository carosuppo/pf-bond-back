import { CreateGroupDto } from '../dto/create-group.dto';
import { GetGroupResponseDto } from '../dto/get-group-response.dto';
import { GetGroupsResponseDto } from '../dto/get-groups-response.dto';
import { GroupResponseDto } from '../dto/group-response.dto';
import { UpdateGroupDto } from '../dto/update-group.dto';
import { GetGroupEntity } from '../entity/get-group.entity';
import { GroupEntity } from '../entity/group.entity';
import { CreateGroupData } from '../interface/create-group.interface';
import { UpdateGroupData } from '../interface/update-group.interface';

export class GroupMapper {
  static toCreatePersistence(
    dto: CreateGroupDto,
    invitationCode: string,
  ): CreateGroupData {
    return {
      name: dto.name,
      description: dto.description,
      shareLocationMandatorily: dto.shareLocationMandatorily,
      invitationCode,
    };
  }

  static toUpdatePersistence(dto: UpdateGroupDto): UpdateGroupData {
    return {
      name: dto.name,
      description: dto.description,
      shareLocationMandatorily: dto.shareLocationMandatorily,
    };
  }

  static toResponse(entity: GroupEntity): GroupResponseDto {
    return {
      id: entity.id,
      name: entity.name,
      description: entity.description ?? null,
      shareLocationMandatorily: entity.shareLocationMandatorily,
      invitationCode: entity.invitationCode,
    };
  }

  static toGroupsResponse(entities: GroupEntity[]): GetGroupsResponseDto[] {
    return entities.map((entity) => ({ id: entity.id, name: entity.name }));
  }

  static toGetGroupResponse(entity: GetGroupEntity): GetGroupResponseDto {
    return {
      id: entity.id,
      name: entity.name,
      description: entity.description ?? null,
      shareLocationMandatorily: entity.shareLocationMandatorily,
      invitationCode: entity.invitationCode,
      members: entity.members.map((member) => ({
        id: member.id,
        idUser: member.idUser,
        name: member.name,
        role: member.role,
      })),
    };
  }
}
