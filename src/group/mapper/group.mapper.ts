import { CreateGroupDto } from '../dto/create-group.dto';
import { GroupResponseDto } from '../dto/group-response.dto';
import { GroupEntity } from '../entity/group.entity';
import { CreateGroupData } from '../interface/create-group.interface';

export class GroupMapper {
  static toPersistence(
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

  static toResponse(entity: GroupEntity): GroupResponseDto {
    return {
      id: entity.id.toString(),
      name: entity.name,
      description: entity.description ?? null,
      shareLocationMandatorily: entity.shareLocationMandatorily,
      invitationCode: entity.invitationCode,
    };
  }
}
