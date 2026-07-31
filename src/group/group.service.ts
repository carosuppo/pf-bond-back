import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { CreateGroupDto } from './dto/create-group.dto';
import { GroupResponseDto } from './dto/group-response.dto';
import { UpdateGroupDto } from './dto/update-group.dto';
import { InvitationCodeHelper } from './helper/invitation-code.helper';
import { GroupMapper } from './mapper/group.mapper';
import type { IGroupRepository } from './repository/group.repository.interface';

@Injectable()
export class GroupService {
  constructor(
    @Inject('groupRepository')
    private readonly groupRepository: IGroupRepository,
    private readonly invitationCodeHelper: InvitationCodeHelper,
  ) {}

  async createGroup(
    createGroupDto: CreateGroupDto,
    userId: number,
  ): Promise<GroupResponseDto> {
    const invitationCode = await this.invitationCodeHelper.generate();

    const persistenceData = GroupMapper.toCreatePersistence(
      createGroupDto,
      invitationCode,
    );

    const createdGroup = await this.groupRepository.create(
      persistenceData,
      userId,
    );

    return GroupMapper.toResponse(createdGroup);
  }

  async update(
    id: number,
    updateGroupDto: UpdateGroupDto,
  ): Promise<GroupResponseDto> {
    const group = await this.groupRepository.findById(id);

    if (!group) {
      throw new NotFoundException('El grupo no existe.');
    }

    const persistenceData = GroupMapper.toUpdatePersistence(updateGroupDto);

    const updatedGroup = await this.groupRepository.update(id, persistenceData);

    return GroupMapper.toResponse(updatedGroup);
  }
}
