import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Get,
  Patch,
  Param,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';

import { CurrentUser } from '../common/decorators/user.decorator';
import { SessionAuthGuard } from '../user/guard/session-auth.guard';
import { RegisterDeviceTokenDto } from './dto/register-device-token.dto';
import { UnregisterDeviceTokenDto } from './dto/unregister-device-token.dto';
import { NotificationService } from './notification.service';

import { NotificationPreferencesService } from './notification-preferences.service';
import {
  UpdateNotificationPreferenceDto,
  UpdateNotificationTypePreferenceDto,
} from './dto/notification-preferences.dto';

@UseGuards(SessionAuthGuard)
@Controller('notification')
export class NotificationController {
  constructor(
    private readonly notificationService: NotificationService,
    private readonly preferences: NotificationPreferencesService,
  ) {}
  @Get('preferences')
  getPreferences(@CurrentUser() userId: number) {
    return this.preferences.get(userId);
  }
  @Patch('preferences/global')
  updateGlobal(
    @CurrentUser() userId: number,
    @Body() dto: UpdateNotificationPreferenceDto,
  ) {
    return this.preferences.updateGlobal(userId, dto.enabled);
  }
  @Patch('preferences/group/:groupId')
  updateGroup(
    @CurrentUser() userId: number,
    @Param('groupId', ParseIntPipe) groupId: number,
    @Body() dto: UpdateNotificationPreferenceDto,
  ) {
    return this.preferences.updateGroup(userId, groupId, dto.enabled);
  }
  @Patch('preferences/group/:groupId/type')
  updateType(
    @CurrentUser() userId: number,
    @Param('groupId', ParseIntPipe) groupId: number,
    @Body() dto: UpdateNotificationTypePreferenceDto,
  ) {
    return this.preferences.updateType(userId, groupId, dto.type, dto.enabled);
  }

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
