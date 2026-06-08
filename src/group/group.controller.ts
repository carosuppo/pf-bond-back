import { Body, Controller, Post } from '@nestjs/common';
import { CreateGroupDto } from './dto/create-group.dto';
import { GroupResponseDto } from './dto/group-response.dto';
import { GroupService } from './group.service';

@Controller('group')
export class GroupController {
  constructor(private readonly groupService: GroupService) {}

  @Post()
  async create(
    @Body() createGroupDto: CreateGroupDto,
  ): Promise<GroupResponseDto> {
    return this.groupService.createGroup(createGroupDto);
  }
}
