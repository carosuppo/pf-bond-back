// src/group/mappers/group.mapper.ts
import { Group, Prisma } from '@prisma/client';
import { CreateGroupDto } from '../dto/create-group.dto';
import { GroupResponseDto } from '../dto/group-response.dto';

export class GroupMapper {
  static toPersistence(
    dto: CreateGroupDto,
    invitationCode: string,
  ): Prisma.GroupCreateInput {
    return {
      name: dto.name,
      description: dto.description,
      shareLocationMandatorily: dto.shareLocationMandatorily,
      invitationCode,
    };
  }

  static toResponse(entity: Group): GroupResponseDto {
    return {
      name: entity.name,
      description: entity.description ?? null,
      shareLocationMandatorily: entity.shareLocationMandatorily,
      invitationCode: entity.invitationCode,
    };
  }
}
