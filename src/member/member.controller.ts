import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../common/decorators/user.decorator';
import type { MessageResponseDto } from '../user/dto/message-response.dto';
import { SessionAuthGuard } from '../user/guard/session-auth.guard';
import { GetMemberInfoResponseDto } from './dto/get-member-info-response.dto';
import { BlockedUserResponseDto } from './dto/blocked-user-response.dto';
import { ReportMemberDto } from './dto/report-member.dto';
import { UpdateMemberRoleDto } from './dto/update-member-role.dto';
import { MemberService } from './member.service';
import { MemberReportService } from './service/member-report.service';
import { UserBlockService } from './service/user-block.service';

@UseGuards(SessionAuthGuard)
@Controller('member')
export class MemberController {
  constructor(
    private readonly memberService: MemberService,
    private readonly memberReportService: MemberReportService,
    private readonly userBlockService: UserBlockService,
  ) {}

  @Get('blocks')
  @UseGuards(SessionAuthGuard)
  getBlockedUsers(
    @CurrentUser() userId: number,
  ): Promise<BlockedUserResponseDto[]> {
    return this.userBlockService.getBlockedUsers(userId);
  }

  @Delete('blocks/:userId')
  @UseGuards(SessionAuthGuard)
  @HttpCode(HttpStatus.OK)
  unblockUser(
    @Param('userId', ParseIntPipe) userId: number,
    @CurrentUser() requesterUserId: number,
  ): Promise<MessageResponseDto> {
    return this.userBlockService.unblockUser(userId, requesterUserId);
  }

  @Get(':memberId')
  async getMemberInfo(
    @Param('memberId', ParseIntPipe) memberId: number,
    @CurrentUser() userId: number,
  ): Promise<GetMemberInfoResponseDto> {
    return this.memberService.getMemberInfo(memberId, userId);
  }

  @Post(':memberId/report')
  @HttpCode(HttpStatus.OK)
  reportMember(
    @Param('memberId', ParseIntPipe) memberId: number,
    @Body() reportMemberDto: ReportMemberDto,
    @CurrentUser() reporterUserId: number,
  ): Promise<MessageResponseDto> {
    return this.memberReportService.reportMember(
      memberId,
      reporterUserId,
      reportMemberDto,
    );
  }

  @Post(':memberId/block')
  @HttpCode(HttpStatus.OK)
  blockMember(
    @Param('memberId', ParseIntPipe) memberId: number,
    @CurrentUser() blockerUserId: number,
  ): Promise<MessageResponseDto> {
    return this.userBlockService.blockMember(memberId, blockerUserId);
  }

  @Put(':memberId/role')
  async updateMemberRole(
    @Param('memberId', ParseIntPipe) memberId: number,
    @Body() dto: UpdateMemberRoleDto,
    @CurrentUser() userId: number,
  ): Promise<MessageResponseDto> {
    return this.memberService.updateMemberRole(memberId, dto, userId);
  }

  @Delete(':memberId')
  async removeMember(
    @Param('memberId', ParseIntPipe) memberId: number,
    @CurrentUser() userId: number,
  ): Promise<MessageResponseDto> {
    return this.memberService.removeMember(memberId, userId);
  }
}
