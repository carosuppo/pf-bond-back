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
import { CalculateRouteDto } from './dto/calculate-route.dto';
import { RouteResponseDto } from './dto/route-response.dto';
import { RoutingService } from './routing.service';

@UseGuards(SessionAuthGuard)
@Controller('group/:groupId/point-of-interest/:pointId/route')
export class RoutingController {
  constructor(private readonly routingService: RoutingService) {}

  @Post()
  calculate(
    @Param('groupId', ParseIntPipe) groupId: number,
    @Param('pointId', ParseIntPipe) pointId: number,
    @CurrentUser() userId: number,
    @Body() dto: CalculateRouteDto,
  ): Promise<RouteResponseDto> {
    return this.routingService.calculateToPoint(groupId, pointId, userId, dto);
  }
}
