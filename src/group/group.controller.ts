import { Body, Controller, Param, ParseIntPipe, Post } from '@nestjs/common';
import { CreateGroupDto } from './dto/create-group.dto';
import { GroupResponseDto } from './dto/group-response.dto';
import { GroupService } from './group.service';

@Controller('group')
export class GroupController {
  constructor(private readonly groupService: GroupService) {}

  @Post(':userId')
  async create(
    @Body() createGroupDto: CreateGroupDto,
    @Param('userId', ParseIntPipe) userId: number,
  ): Promise<GroupResponseDto> {
    return await this.groupService.createGroup(createGroupDto, userId);
  }
}
