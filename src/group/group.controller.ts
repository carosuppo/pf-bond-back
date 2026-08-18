import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Get,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../common/decorators/user.decorator';
import type { MessageResponseDto } from '../user/dto/message-response.dto';
import { SessionAuthGuard } from '../user/guard/session-auth.guard';
import { CreateGroupDto } from './dto/create-group.dto';
import { GetGroupResponseDto } from './dto/get-group-response.dto';
import { GetGroupsResponseDto } from './dto/get-groups-response.dto';
import { GroupResponseDto } from './dto/group-response.dto';
import { JoinGroupDto } from './dto/join-group.dto';
import { UpdateGroupDto } from './dto/update-group.dto';
import { GroupService } from './group.service';
import { NormalizeInvitationCodePipe } from './pipe/normalize-invitation-code.pipe';

@UseGuards(SessionAuthGuard)
@Controller('group')
export class GroupController {
  constructor(private readonly groupService: GroupService) {}

  @Post('join')
  async join(
    @Body(NormalizeInvitationCodePipe) dto: JoinGroupDto,
    @CurrentUser() user: number,
  ): Promise<MessageResponseDto> {
    return await this.groupService.join(dto, user);
  }

  @Put(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateGroupDto,
    @CurrentUser() userId: number,
  ): Promise<GroupResponseDto> {
    return this.groupService.update(id, dto, userId);
  }

  @Post()
  async create(
    @Body() dto: CreateGroupDto,
    @CurrentUser() userId: number,
  ): Promise<GroupResponseDto> {
    return this.groupService.createGroup(dto, userId);
  }

  @Get(':id')
  async getOne(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() userId: number,
  ): Promise<GetGroupResponseDto> {
    return this.groupService.getOne(id, userId);
  }

  @Get()
  async getAll(@CurrentUser() userId: number): Promise<GetGroupsResponseDto[]> {
    return this.groupService.getAll(userId);
  }

  @Get()
  findByUser(@CurrentUser() userId: number): Promise<GroupResponseDto[]> {
    return this.groupService.findByUser(userId);
  }
}
