import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../common/decorators/user.decorator';
import { SessionAuthGuard } from '../user/guard/session-auth.guard';
import { CreateEventDto } from './dto/create-event.dto';
import { EventQueryDto } from './dto/event-query.dto';
import { EventResponseDto } from './dto/event-response.dto';
import { SetEventLocationDto } from './dto/set-event-location.dto';
import { UpdateEventDto } from './dto/update-event.dto';
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
    @Query() query: EventQueryDto,
    @CurrentUser() userId: number,
  ): Promise<EventResponseDto[]> {
    return this.eventService.getEventsByGroup(
      groupId,
      userId,
      query.year,
      query.month,
    );
  }

  @Post()
  create(
    @Param('groupId', ParseIntPipe) groupId: number,
    @Body() dto: CreateEventDto,
    @CurrentUser() userId: number,
  ): Promise<EventResponseDto> {
    return this.eventService.createEvent(dto, groupId, userId);
  }

  @Patch(':id')
  update(
    @Param('groupId', ParseIntPipe) groupId: number,
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() userId: number,
    @Body() dto: UpdateEventDto,
  ): Promise<EventResponseDto> {
    return this.eventService.updateEvent(dto, id, groupId, userId);
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
