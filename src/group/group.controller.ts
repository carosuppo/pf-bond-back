import {
  Body,
  Controller,
  Param,
  ParseIntPipe,
  Post,
  Put,
} from '@nestjs/common';
import { CreateGroupDto } from './dto/create-group.dto';
import { GroupResponseDto } from './dto/group-response.dto';
import { UpdateGroupDto } from './dto/update-group.dto';
import { GroupService } from './group.service';

@Controller('group')
export class GroupController {
  constructor(private readonly groupService: GroupService) {}

  @Post(':userId')
  create(
    @Body() createGroupDto: CreateGroupDto,
    @Param('userId', ParseIntPipe) userId: number,
  ): Promise<GroupResponseDto> {
    return this.groupService.createGroup(createGroupDto, userId);
  }

  @Put(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateGroupDto) {
    return this.groupService.update(id, dto);
  }
}
