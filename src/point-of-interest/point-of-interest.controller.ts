import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';

import { CurrentUser } from '../common/decorators/user.decorator';
import { SessionAuthGuard } from '../user/guard/session-auth.guard';
import { CreatePointOfInterestDto } from './dto/create-point-of-interest.dto';
import { PointOfInterestResponseDto } from './dto/point-of-interest-response.dto';
import { UpdatePointOfInterestDto } from './dto/update-point-of-interest.dto';
import { PointOfInterestService } from './point-of-interest.service';

@UseGuards(SessionAuthGuard)
@Controller('group/:groupId/point-of-interest')
export class PointOfInterestController {
  constructor(
    private readonly pointOfInterestService: PointOfInterestService,
  ) {}

  @Post()
  create(
    @Param('groupId', ParseIntPipe) groupId: number,
    @CurrentUser() userId: number,
    @Body() dto: CreatePointOfInterestDto,
  ): Promise<PointOfInterestResponseDto> {
    return this.pointOfInterestService.create(groupId, userId, dto);
  }

  @Get()
  getByGroup(
    @Param('groupId', ParseIntPipe) groupId: number,
    @CurrentUser() userId: number,
  ): Promise<PointOfInterestResponseDto[]> {
    return this.pointOfInterestService.getByGroup(groupId, userId);
  }

  @Patch(':pointId')
  update(
    @Param('groupId', ParseIntPipe) groupId: number,
    @Param('pointId', ParseIntPipe) pointId: number,
    @CurrentUser() userId: number,
    @Body() dto: UpdatePointOfInterestDto,
  ): Promise<PointOfInterestResponseDto> {
    return this.pointOfInterestService.update(groupId, pointId, userId, dto);
  }

  @Delete(':pointId')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @Param('groupId', ParseIntPipe) groupId: number,
    @Param('pointId', ParseIntPipe) pointId: number,
    @CurrentUser() userId: number,
  ): Promise<void> {
    return this.pointOfInterestService.remove(groupId, pointId, userId);
  }
}
