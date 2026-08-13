import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Put,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../common/decorators/user.decorator';
import { SessionAuthGuard } from '../user/guard/session-auth.guard';
import { CurrentLocationResponseDto } from './dto/current-location-response.dto';
import { LocationSharingResponseDto } from './dto/location-sharing-response.dto';
import { MemberLocationResponseDto } from './dto/member-location-response.dto';
import { UpdateCurrentLocationDto } from './dto/update-current-location.dto';
import { UpdateLocationSharingDto } from './dto/update-location-sharing.dto';
import { LocationService } from './location.service';

@UseGuards(SessionAuthGuard)
@Controller('location')
export class LocationController {
  constructor(private readonly locationService: LocationService) {}

  @Put('current')
  updateCurrentLocation(
    @CurrentUser() userId: number,
    @Body() dto: UpdateCurrentLocationDto,
  ): Promise<CurrentLocationResponseDto> {
    return this.locationService.updateCurrentLocation(userId, dto);
  }

  @Get('sharing')
  getSharing(
    @CurrentUser() userId: number,
  ): Promise<LocationSharingResponseDto[]> {
    return this.locationService.getSharing(userId);
  }

  @Put('group/:groupId/sharing')
  updateGroupSharing(
    @CurrentUser() userId: number,
    @Param('groupId', ParseIntPipe) groupId: number,
    @Body() dto: UpdateLocationSharingDto,
  ): Promise<LocationSharingResponseDto> {
    return this.locationService.updateGroupSharing(
      userId,
      groupId,
      dto.enabled,
    );
  }

  @Get('group/:groupId/members')
  getGroupMembers(
    @CurrentUser() userId: number,
    @Param('groupId', ParseIntPipe) groupId: number,
  ): Promise<MemberLocationResponseDto[]> {
    return this.locationService.getGroupMembers(userId, groupId);
  }
}
