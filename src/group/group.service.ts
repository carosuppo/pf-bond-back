// src/group/group.service.ts
import { Inject, Injectable } from '@nestjs/common';
import { CreateGroupDto } from './dto/create-group.dto';
import { GroupResponseDto } from './dto/group-response.dto';
import { GroupMapper } from './mapper/group.mapper';
import type { IGroupRepository } from './repository/group.repository.interface';
import { InvitationCodeValidator } from './validator/invitation-code.validator';

@Injectable()
export class GroupService {
  constructor(
    @Inject('groupRepository')
    private readonly groupRepository: IGroupRepository,
    private readonly invitationCodeValidator: InvitationCodeValidator,
  ) {}

  async createGroup(createGroupDto: CreateGroupDto): Promise<GroupResponseDto> {
    const invitationCode = await this.generateInvitationCode();

    const persistenceData = GroupMapper.toPersistence(
      createGroupDto,
      invitationCode,
    );

    const createdGroup = await this.groupRepository.create(persistenceData);

    return GroupMapper.toResponse(createdGroup);
  }

  private createRandomInvitationCode(length = 6): string {
    const characters = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

    return Array.from(
      { length },
      () => characters[Math.floor(Math.random() * characters.length)],
    ).join('');
  }

  private async generateInvitationCode(): Promise<string> {
    let invitationCode: string;

    do {
      invitationCode = this.createRandomInvitationCode();
    } while (!(await this.invitationCodeValidator.isAvailable(invitationCode)));

    return invitationCode;
  }
}
