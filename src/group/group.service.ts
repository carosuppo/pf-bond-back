import { Inject, Injectable } from '@nestjs/common';
import { CreateGroupDto } from './dto/create-group.dto';
import { GroupResponseDto } from './dto/group-response.dto';
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

    const persistenceData = GroupMapper.toPersistence(
      createGroupDto,
      invitationCode,
    );

    const createdGroup = await this.groupRepository.createGroup(
      persistenceData,
      userId,
    );

    return GroupMapper.toResponse(createdGroup);
  }
}
