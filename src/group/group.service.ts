// src/group/group.service.ts
import { Inject, Injectable } from '@nestjs/common';
import { CreateGroupDto } from './dto/create-group.dto';
import { GroupResponseDto } from './dto/group-response.dto';
import { GroupMapper } from './mapper/group.mapper';
import type { IGroupRepository } from './repository/group.repository.interface';

@Injectable()
export class GroupService {
  constructor(
    @Inject('groupRepository')
    private readonly groupRepository: IGroupRepository,
  ) {}

  async createGroup(createGroupDto: CreateGroupDto): Promise<GroupResponseDto> {
    // 1. Mapear DTO de entrada a datos de persistencia
    const persistenceData = GroupMapper.toPersistence(createGroupDto);

    // 2. Guardar en la base de datos mediante el repositorio
    const createdGroup = await this.groupRepository.create(persistenceData);

    // 3. Mapear la entidad de la base de datos al DTO de salida
    return GroupMapper.toResponse(createdGroup);
  }
}
