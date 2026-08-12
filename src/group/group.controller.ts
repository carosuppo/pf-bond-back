import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../common/decorators/user.decorator';
import { SessionAuthGuard } from '../user/guard/session-auth.guard';
import { CreateGroupDto } from './dto/create-group.dto';
import { GetGroupsResponseDto } from './dto/get-groups-response.dto';
import { GroupResponseDto } from './dto/group-response.dto';
import { UpdateGroupDto } from './dto/update-group.dto';
import { GroupService } from './group.service';

@UseGuards(SessionAuthGuard)
@Controller('group')
export class GroupController {
  constructor(private readonly groupService: GroupService) {}

  @Post()
  async create(
    @Body() dto: CreateGroupDto,
    @CurrentUser() user: number,
  ): Promise<GroupResponseDto> {
    return this.groupService.createGroup(dto, user);
  }

  @Put(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateGroupDto,
    @CurrentUser() user: number,
  ): Promise<GroupResponseDto> {
    return this.groupService.update(id, dto, user);
  }

  @Get(':id')
  async getOne(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<GroupResponseDto> {
    return this.groupService.getOne(id);
  }

  @Get()
  async getAll(@CurrentUser() user: number): Promise<GetGroupsResponseDto[]> {
    return this.groupService.getAll(user);
  }
}
