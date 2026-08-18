import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { RoleEnum } from '@prisma/client';
import type { IMemberRepository } from '../member/repository/member.repository.interface';
import type { MessageResponseDto } from '../user/dto/message-response.dto';
import { CreateGroupDto } from './dto/create-group.dto';
import { GetGroupResponseDto } from './dto/get-group-response.dto';
import { GetGroupsResponseDto } from './dto/get-groups-response.dto';
import { GroupResponseDto } from './dto/group-response.dto';
import { JoinGroupDto } from './dto/join-group.dto';
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

  async findByUser(userId: number): Promise<GroupResponseDto[]> {
    const groups = await this.groupRepository.findByUserId(userId);

    return groups.map((group) => GroupMapper.toResponse(group));
  }

  async getOne(id: number, userId: number): Promise<GetGroupResponseDto> {
    const group = await this.groupRepository.findGroupWithMembers(id);

    if (!group) {
      throw new NotFoundException('El grupo no existe.');
    }

    const member = await this.memberRepository.findByUserAndGroup(userId, id);

    if (!member) {
      throw new ForbiddenException('No perteneces a este grupo.');
    }

    return GroupMapper.toGetGroupResponse(group);
  }

  async getAll(userId: number): Promise<GetGroupsResponseDto[]> {
    const groups = await this.groupRepository.findByUserId(userId);

    return GroupMapper.toGroupsResponse(groups);
  }

  async join(
    joinGroupDto: JoinGroupDto,
    userId: number,
  ): Promise<MessageResponseDto> {
    const group = await this.groupRepository.findByInvitationCode(
      joinGroupDto.invitationCode,
    );

    if (!group || group.deletedAt) {
      throw new BadRequestException(
        'El código de invitación es inválido o no corresponde a ningún grupo vigente.',
      );
    }

    const existingMember = await this.memberRepository.findByUserAndGroup(
      userId,
      group.id,
    );

    if (existingMember) {
      throw new ConflictException('Ya eres miembro de este grupo.');
    }

    await this.memberRepository.addMember({
      groupId: group.id,
      userId,
      role: RoleEnum.MEMBER,
    });

    return {
      message: 'Ingresaste al grupo correctamente.',
    };
  }
}
