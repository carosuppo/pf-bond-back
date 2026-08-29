import {
  Body,
  Controller,
  Param,
  ParseIntPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../common/decorators/user.decorator';
import { SessionAuthGuard } from '../user/guard/session-auth.guard';
import { CreateEventDto } from './dto/create-event.dto';
import { EventResponseDto } from './dto/event-response.dto';
import { EventService } from './event.service';

@UseGuards(SessionAuthGuard)
@Controller('group/:groupId/event')
export class EventController {
  constructor(private readonly eventService: EventService) {}

  @Post()
  async create(
    @Param('groupId', ParseIntPipe) groupId: number,
    @Body() dto: CreateEventDto,
    @CurrentUser() userId: number,
  ): Promise<EventResponseDto> {
    return this.eventService.createEvent(dto, groupId, userId);
  }
}
