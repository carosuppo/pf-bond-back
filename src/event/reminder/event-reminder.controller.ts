import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Put,
  UseGuards,
} from '@nestjs/common';

import { CurrentUser } from '../../common/decorators/user.decorator';
import { SessionAuthGuard } from '../../user/guard/session-auth.guard';
import {
  EventReminderResponseDto,
  EventRemindersResponseDto,
} from './dto/event-reminder-response.dto';
import { SetEventRemindersDto } from './dto/set-event-reminders.dto';
import { EventReminderService } from './event-reminder.service';

@UseGuards(SessionAuthGuard)
@Controller('group/:groupId/event/:id/reminders')
export class EventReminderController {
  constructor(private readonly eventReminderService: EventReminderService) {}

  @Get()
  getMine(
    @Param('groupId', ParseIntPipe) groupId: number,
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() userId: number,
  ): Promise<EventReminderResponseDto[]> {
    return this.eventReminderService.getMyReminders(id, groupId, userId);
  }

  @Put()
  setMine(
    @Param('groupId', ParseIntPipe) groupId: number,
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() userId: number,
    @Body() dto: SetEventRemindersDto,
  ): Promise<EventRemindersResponseDto> {
    return this.eventReminderService.setMyReminders(dto, id, groupId, userId);
  }

  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteMine(
    @Param('groupId', ParseIntPipe) groupId: number,
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() userId: number,
  ): Promise<void> {
    await this.eventReminderService.deleteMyReminders(id, groupId, userId);
  }
}
