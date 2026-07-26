import { Inject, Injectable } from '@nestjs/common';
import { Prisma, RoleEnum } from '@prisma/client';
import { AddMemberDto } from './dto/add-member.dto';
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
}
