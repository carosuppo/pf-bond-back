// src/group/mappers/group.mapper.ts
import { Group, Prisma } from '@prisma/client';
import { CreateGroupDto } from '../dto/create-group.dto';
import { GroupResponseDto } from '../dto/group-response.dto';

export class GroupMapper {
  /**
   * De Controlador (DTO) a Repositorio (Prisma)
   */
  static toPersistence(dto: CreateGroupDto): Prisma.GroupCreateInput {
    return {
      name: dto.name,
      shareLocationMandatorily: dto.shareLocationMandatorily ?? false,
    };
  }

  /**
   * De Repositorio (Prisma) a Controlador (Response DTO)
   */
  static toResponse(entity: Group): GroupResponseDto {
    return {
      id: entity.id,
      name: entity.name,
      shareLocationMandatorily: entity.shareLocationMandatorily,
    };
  }
}
