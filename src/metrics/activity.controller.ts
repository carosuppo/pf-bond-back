import {
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../common/decorators/user.decorator';
import { SessionAuthGuard } from '../user/guard/session-auth.guard';
import { ActivityService } from './activity.service';

@Controller('user/activity')
@UseGuards(SessionAuthGuard)
export class ActivityController {
  constructor(private readonly activityService: ActivityService) {}

  @Post()
  @HttpCode(HttpStatus.NO_CONTENT)
  record(@CurrentUser() userId: number): Promise<void> {
    return this.activityService.record(userId);
  }
}
