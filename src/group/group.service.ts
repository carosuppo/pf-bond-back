import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { RoleEnum } from '@prisma/client';
import { randomUUID } from 'crypto';
import { logErrorSafely } from '../common/logging/error-logging';
import { NotificationService } from '../notification/notification.service';
import type { IMemberRepository } from '../member/repository/member.repository.interface';
import type { MessageResponseDto } from '../user/dto/message-response.dto';
import { MAX_PROFILE_PHOTO_SIZE } from '../user/constants/profile-photo.constants';
import type { ProfilePhotoFile } from '../user/interface/profile-photo-file.interface';
import { SupabaseStorageService } from '../user/storage/supabase-storage.service';
import { CreateGroupDto } from './dto/create-group.dto';
import { GetGroupResponseDto } from './dto/get-group-response.dto';
import { GroupResponseDto } from './dto/group-response.dto';
import { JoinGroupResponseDto } from './dto/join-group-response.dto';
import { JoinGroupDto } from './dto/join-group.dto';
import {
  GroupJoinRequestActionResponseDto,
  GroupJoinRequestResponseDto,
} from './dto/group-join-request-response.dto';
import { UpdateGroupDto } from './dto/update-group.dto';
import { InvitationCodeHelper } from './helper/invitation-code.helper';
import { GroupEventService } from './group-event.service';
import { GroupMapper } from './mapper/group.mapper';
import type { IGroupRepository } from './repository/group.repository.interface';
import type {
  GroupJoinRequestResolution,
  IGroupJoinRequestRepository,
} from './repository/group-join-request.repository.interface';

@Injectable()
export class GroupService {
  private readonly logger = new Logger(GroupService.name);

  constructor(
    @Inject('groupRepository')
    private readonly groupRepository: IGroupRepository,
    private readonly invitationCodeHelper: InvitationCodeHelper,
    @Inject('memberRepository')
    private readonly memberRepository: IMemberRepository,
    private readonly supabaseStorageService: SupabaseStorageService,
    @Inject('groupJoinRequestRepository')
    private readonly groupJoinRequestRepository: IGroupJoinRequestRepository,
    private readonly notificationService: NotificationService,
    private readonly groupEventService: GroupEventService,
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

  async delete(id: number, userId: number): Promise<void> {
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
        'Solo los administradores pueden eliminar el grupo.',
      );
    }

    const deleted = await this.groupRepository.softDelete(id);

    if (!deleted) {
      throw new NotFoundException('El grupo no existe.');
    }

    this.groupEventService.publish({
      event: 'groupDeleted',
      data: { groupId: id, actorUserId: userId },
    });
  }

  async leave(id: number, userId: number): Promise<MessageResponseDto> {
    const result = await this.groupRepository.leave(id, userId);

    if (result.status === 'notFound') {
      throw new NotFoundException('El grupo no existe.');
    }

    if (result.status === 'notMember') {
      throw new ForbiddenException('No perteneces a este grupo.');
    }

    if (result.status === 'deleted') {
      this.groupEventService.publish({
        event: 'groupDeleted',
        data: { groupId: id, actorUserId: userId },
      });
    } else {
      this.groupEventService.publish({
        event: 'memberLeft',
        data: {
          groupId: id,
          memberId: result.memberId,
          userId,
          actorUserId: userId,
        },
      });
    }

    return { message: 'Dejaste el grupo.' };
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

    const submission = await this.groupJoinRequestRepository.submit(
      group.id,
      userId,
    );

    if (submission.status === 'alreadyMember') {
      throw new ConflictException({
        message: 'Ya eres miembro de este grupo.',
        group: { id: group.id, name: group.name },
        alreadyPending: false,
      });
    }

    if (submission.status === 'created') {
      const administratorIds =
        await this.groupJoinRequestRepository.findAdminUserIds(group.id);
      try {
        await this.notificationService.sendToUsers(administratorIds, {
          title: 'Nueva solicitud de ingreso',
          body: `Hay una nueva solicitud para ingresar al grupo ${group.name}.`,
          data: {
            type: 'GROUP_JOIN_REQUEST',
            groupId: String(group.id),
            requestId: String(submission.requestId),
          },
        });
      } catch (error: unknown) {
        logErrorSafely(
          this.logger,
          'operation=notifyGroupAdministratorsOfJoinRequest outcome=error',
          error,
        );
      }
    }

    return {
      message:
        submission.status === 'pending'
          ? 'Ya enviaste una solicitud para ingresar a este grupo.'
          : 'Tu solicitud para ingresar al grupo fue enviada correctamente.',
      group: { id: group.id, name: group.name },
      alreadyPending: submission.status === 'pending',
    };
  }

  async getJoinRequests(
    adminUserId: number,
  ): Promise<GroupJoinRequestResponseDto[]> {
    return this.groupJoinRequestRepository.findPendingForAdmin(adminUserId);
  }

  async acceptJoinRequest(
    requestId: number,
    adminUserId: number,
  ): Promise<GroupJoinRequestActionResponseDto> {
    return this.resolveJoinRequest(
      await this.groupJoinRequestRepository.accept(requestId, adminUserId),
      true,
    );
  }

  async rejectJoinRequest(
    requestId: number,
    adminUserId: number,
  ): Promise<GroupJoinRequestActionResponseDto> {
    return this.resolveJoinRequest(
      await this.groupJoinRequestRepository.reject(requestId, adminUserId),
      false,
    );
  }

  private async resolveJoinRequest(
    result: GroupJoinRequestResolution,
    accepted: boolean,
  ): Promise<GroupJoinRequestActionResponseDto> {
    if (result.status === 'notFound') {
      throw new NotFoundException('La solicitud ya no está disponible.');
    }
    if (result.status === 'notPending') {
      throw new ConflictException('La solicitud ya fue resuelta.');
    }
    if (result.status === 'forbidden') {
      throw new ForbiddenException(
        'Solo los administradores pueden gestionar solicitudes de ingreso.',
      );
    }

    try {
      await this.notificationService.sendToUser(result.requesterUserId, {
        title: accepted ? 'Solicitud aceptada' : 'Solicitud rechazada',
        body: accepted
          ? `Tu solicitud para ingresar al grupo ${result.groupName} fue aceptada.`
          : `Tu solicitud para ingresar al grupo ${result.groupName} fue rechazada.`,
        data: {
          type: accepted
            ? 'GROUP_JOIN_REQUEST_ACCEPTED'
            : 'GROUP_JOIN_REQUEST_REJECTED',
          groupId: String(result.groupId),
        },
      });
    } catch (error: unknown) {
      logErrorSafely(
        this.logger,
        'operation=notifyRequesterOfJoinRequestResolution outcome=error',
        error,
      );
    }

    return {
      message: accepted
        ? 'Solicitud aceptada correctamente.'
        : 'Solicitud rechazada correctamente.',
    };
  }
}
