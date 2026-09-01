import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Put,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../common/decorators/user.decorator';
import type { MessageResponseDto } from '../user/dto/message-response.dto';
import { SessionAuthGuard } from '../user/guard/session-auth.guard';
import { GetMemberInfoResponseDto } from './dto/get-member-info-response.dto';
import { UpdateMemberRoleDto } from './dto/update-member-role.dto';
import { MemberService } from './member.service';

@UseGuards(SessionAuthGuard)
@Controller('member')
export class MemberController {
  constructor(private readonly memberService: MemberService) {}

  @Get(':memberId')
  getMemberInfo(
    @Param('memberId', ParseIntPipe) memberId: number,
    @CurrentUser() userId: number,
  ): Promise<GetMemberInfoResponseDto> {
    return this.memberService.getMemberInfo(memberId, userId);
  }

  @Put(':memberId/role')
  updateMemberRole(
    @Param('memberId', ParseIntPipe) memberId: number,
    @Body() dto: UpdateMemberRoleDto,
    @CurrentUser() userId: number,
  ): Promise<MessageResponseDto> {
    return this.memberService.updateMemberRole(memberId, dto, userId);
  }
}
