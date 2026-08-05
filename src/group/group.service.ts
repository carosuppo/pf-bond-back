import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { RoleEnum } from '@prisma/client';
import type { IMemberRepository } from '../member/repository/member.repository.interface';
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
    @Inject('memberRepository')
    private readonly memberRepository: IMemberRepository,
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
    userId: number,
  ): Promise<GroupResponseDto> {
    const group = await this.groupRepository.findById(id);

    if (!group) {
      throw new NotFoundException('El grupo no existe.');
    }

    const member = await this.memberRepository.findByUserAndGroup(userId, id);

    if (!member) {
      throw new ForbiddenException('No perteneces a este grupo.');
    }

    if (member.role !== RoleEnum.ADMIN) {
      throw new ForbiddenException(
        'Solo los administradores pueden modificar el grupo.',
      );
    }

    const persistenceData = GroupMapper.toUpdatePersistence(updateGroupDto);

    const updatedGroup = await this.groupRepository.update(id, persistenceData);

    return GroupMapper.toResponse(updatedGroup);
  }
}
