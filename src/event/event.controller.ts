import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../common/decorators/user.decorator';
import { SessionAuthGuard } from '../user/guard/session-auth.guard';
import { EventResponseDto } from './dto/event-response.dto';
import { EventService } from './event.service';

@UseGuards(SessionAuthGuard)
@Controller('group/:groupId/event')
export class EventController {
  constructor(private readonly eventService: EventService) {}

  @Get(':id')
  async getOne(
    @Param('groupId', ParseIntPipe) groupId: number,
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() userId: number,
  ): Promise<EventResponseDto> {
    return this.eventService.getEventById(id, groupId, userId);
  }

  @Get()
  getAll(
    @Param('groupId', ParseIntPipe) groupId: number,
    @CurrentUser() userId: number,
  ): Promise<EventResponseDto[]> {
    return this.eventService.getEventsByGroup(groupId, userId);
  }
}
