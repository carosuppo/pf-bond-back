import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../common/decorators/user.decorator';
import { SessionAuthGuard } from '../user/guard/session-auth.guard';
import { EventQueryDto } from './dto/event-query.dto';
import { EventResponseDto } from './dto/event-response.dto';
import { SetEventLocationDto } from './dto/set-event-location.dto';
import { EventService } from './event.service';

@UseGuards(SessionAuthGuard)
@Controller('group/:groupId/event')
export class EventController {
  constructor(private readonly eventService: EventService) {}

  @Get()
  getAll(
    @Param('groupId', ParseIntPipe) groupId: number,
    @Query() query: EventQueryDto,
    @CurrentUser() userId: number,
  ): Promise<EventResponseDto[]> {
    return this.eventService.getEventsByGroup(groupId, userId, query.year);
  }

  @Get(':id')
  async getOne(
    @Param('groupId', ParseIntPipe) groupId: number,
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() userId: number,
  ): Promise<EventResponseDto> {
    return this.eventService.getEventById(groupId, id, userId);
  }

  @Patch(':id/location')
  setLocation(
    @Param('groupId', ParseIntPipe) groupId: number,
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() userId: number,
    @Body() dto: SetEventLocationDto,
  ): Promise<EventResponseDto> {
    return this.eventService.setEventLocation(
      groupId,
      id,
      userId,
      dto.latitude,
      dto.longitude,
    );
  }
}
