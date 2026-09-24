import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { RoleEnum } from '@prisma/client';
import { randomUUID } from 'crypto';
import type { IMemberRepository } from '../member/repository/member.repository.interface';
import { MAX_PROFILE_PHOTO_SIZE } from '../user/constants/profile-photo.constants';
import type { ProfilePhotoFile } from '../user/interface/profile-photo-file.interface';
import { SupabaseStorageService } from '../user/storage/supabase-storage.service';
import { CreateGroupDto } from './dto/create-group.dto';
import { GetGroupResponseDto } from './dto/get-group-response.dto';
import { GroupResponseDto } from './dto/group-response.dto';
import { JoinGroupResponseDto } from './dto/join-group-response.dto';
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
    private readonly supabaseStorageService: SupabaseStorageService,
  ) {}

  async createGroup(
    createGroupDto: CreateGroupDto,
    userId: number,
  ): Promise<GroupResponseDto> {
    const invitationCode = await this.invitationCodeHelper.generate();
    const image =
      await this.supabaseStorageService.getRandomDefaultGroupImage();

    const persistenceData = GroupMapper.toCreatePersistence(
      createGroupDto,
      invitationCode,
      image,
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

  async updateImage(
    id: number,
    file: ProfilePhotoFile | undefined,
    userId: number,
  ): Promise<GroupResponseDto> {
    const group = await this.groupRepository.findById(id);

    if (!group) {
      throw new NotFoundException('El grupo no existe.');
    }

    const member = await this.memberRepository.findByUserAndGroup(userId, id);

    if (!member || member.role !== RoleEnum.ADMIN) {
      throw new ForbiddenException(
        'Solo los administradores pueden modificar el grupo.',
      );
    }

    this.validateImage(file);

    const extension =
      file.mimetype === 'image/jpeg'
        ? 'jpg'
        : file.mimetype === 'image/png'
          ? 'png'
          : 'webp';
    const image = await this.supabaseStorageService.upload(
      `groups/${id}/${randomUUID()}.${extension}`,
      file.buffer,
      file.mimetype,
    );

    const updatedGroup = await this.groupRepository.updateImage(id, image);

    return GroupMapper.toResponse(updatedGroup);
  }

  private validateImage(
    file: ProfilePhotoFile | undefined,
  ): asserts file is ProfilePhotoFile {
    if (!file || !file.buffer || !file.mimetype) {
      throw new BadRequestException('Debes seleccionar una imagen.');
    }

    if (file.buffer.length > MAX_PROFILE_PHOTO_SIZE) {
      throw new BadRequestException('La imagen no puede superar los 5 MB.');
    }

    if (
      !new Set(['image/jpeg', 'image/png', 'image/webp']).has(file.mimetype) ||
      !this.hasValidImageSignature(file.buffer, file.mimetype)
    ) {
      throw new BadRequestException(
        'El formato de la imagen debe ser JPEG, PNG o WebP.',
      );
    }
  }

  private hasValidImageSignature(buffer: Buffer, mimetype: string): boolean {
    if (mimetype === 'image/jpeg') {
      return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
    }

    if (mimetype === 'image/png') {
      return buffer
        .subarray(0, 8)
        .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    }

    return (
      buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
      buffer.subarray(8, 12).toString('ascii') === 'WEBP'
    );
  }

  async getAll(userId: number): Promise<GroupResponseDto[]> {
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

  async join(
    joinGroupDto: JoinGroupDto,
    userId: number,
  ): Promise<JoinGroupResponseDto> {
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
      throw new ConflictException(
        GroupMapper.toJoinResponse(group, 'Ya eres miembro de este grupo.'),
      );
    }

    await this.memberRepository.addMember({
      groupId: group.id,
      userId,
      role: RoleEnum.MEMBER,
    });

    return GroupMapper.toJoinResponse(
      group,
      'Ingresaste al grupo correctamente.',
    );
  }
}
