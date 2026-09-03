import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';

import { CurrentUser } from '../common/decorators/user.decorator';
import { SessionAuthGuard } from '../user/guard/session-auth.guard';
import { RegisterDeviceTokenDto } from './dto/register-device-token.dto';
import { UnregisterDeviceTokenDto } from './dto/unregister-device-token.dto';
import { NotificationService } from './notification.service';

@UseGuards(SessionAuthGuard)
@Controller('notification')
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Post('device-token')
  @HttpCode(HttpStatus.NO_CONTENT)
  async registerDeviceToken(
    @CurrentUser() userId: number,
    @Body() dto: RegisterDeviceTokenDto,
  ): Promise<void> {
    await this.notificationService.registerDeviceToken(
      userId,
      dto.token,
      dto.platform,
    );
  }

  @Post('device-token/unregister')
  @HttpCode(HttpStatus.NO_CONTENT)
  async unregisterDeviceToken(
    @CurrentUser() userId: number,
    @Body() dto: UnregisterDeviceTokenDto,
  ): Promise<void> {
    await this.notificationService.unregisterDeviceToken(userId, dto.token);
  }
}
