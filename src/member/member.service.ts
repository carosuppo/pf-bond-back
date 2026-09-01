import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, RoleEnum } from '@prisma/client';
import type { MessageResponseDto } from '../user/dto/message-response.dto';
import { AddMemberDto } from './dto/add-member.dto';
import { GetMemberInfoResponseDto } from './dto/get-member-info-response.dto';
import { UpdateMemberRoleDto } from './dto/update-member-role.dto';
import { MemberMapper } from './mapper/member.mapper';
import type { IMemberRepository } from './repository/member.repository.interface';

@Injectable()
export class MemberService {
  constructor(
    @Inject('memberRepository')
    private readonly memberRepository: IMemberRepository,
  ) {}
  async addMember(
    addMemberDto: AddMemberDto,
    role: RoleEnum,
    prisma?: Prisma.TransactionClient,
  ): Promise<void> {
    const addMemberData = MemberMapper.toAddMemberData(addMemberDto, role);
    await this.memberRepository.addMember(addMemberData, prisma);
  }

  async getMemberInfo(
    memberId: number,
    requesterUserId: number,
  ): Promise<GetMemberInfoResponseDto> {
    const member = await this.memberRepository.findByIdWithUser(memberId);

    if (!member) {
      throw new NotFoundException('El miembro no existe.');
    }

    const membership = await this.memberRepository.findByUserAndGroup(
      requesterUserId,
      member.groupId,
    );

    if (!membership) {
      throw new ForbiddenException('No perteneces a este grupo.');
    }

    return MemberMapper.toGetMemberInfoResponse(member);
  }

  async updateMemberRole(
    memberId: number,
    updateMemberRoleDto: UpdateMemberRoleDto,
    requesterUserId: number,
  ): Promise<MessageResponseDto> {
    const targetMember = await this.memberRepository.findById(memberId);

    if (!targetMember) {
      throw new NotFoundException('El miembro no existe.');
    }

    const requester = await this.memberRepository.findByUserAndGroup(
      requesterUserId,
      targetMember.groupId,
    );

    if (!requester) {
      throw new ForbiddenException('No perteneces a este grupo.');
    }

    if (requester.role !== RoleEnum.ADMIN) {
      throw new ForbiddenException(
        'Solo los administradores pueden modificar los roles.',
      );
    }

    if (
      targetMember.role === RoleEnum.ADMIN &&
      updateMemberRoleDto.role === RoleEnum.MEMBER
    ) {
      const adminCount = await this.memberRepository.countAdminsByGroup(
        targetMember.groupId,
      );

      if (adminCount <= 1) {
        throw new ForbiddenException(
          'Debe haber al menos un administrador en el grupo.',
        );
      }
    }

    await this.memberRepository.updateRole(memberId, updateMemberRoleDto.role);

    return {
      message:
        updateMemberRoleDto.role === RoleEnum.ADMIN
          ? 'El miembro ahora es Administrador.'
          : 'El miembro ahora es Miembro.',
    };
  }
}
