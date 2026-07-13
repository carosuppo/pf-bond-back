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
  Query,
} from '@nestjs/common';
import { CreatePointOfInterestDto } from './dto/create-point-of-interest.dto';
import { DeletePointOfInterestDto } from './dto/delete-point-of-interest.dto';
import { PointOfInterestResponseDto } from './dto/point-of-interest-response.dto';
import { UpdatePointOfInterestDto } from './dto/update-point-of-interest.dto';
import { PointOfInterestService } from './point-of-interest.service';

@Controller('point-of-interest')
export class PointOfInterestController {
  constructor(
    private readonly pointOfInterestService: PointOfInterestService,
  ) {}

  @Post()
  async create(
    @Body() createPointOfInterestDto: CreatePointOfInterestDto,
  ): Promise<PointOfInterestResponseDto> {
    return this.pointOfInterestService.create(createPointOfInterestDto);
  }

  @Get()
  async findByGroup(
    @Query('groupId', ParseIntPipe) groupId: number,
    @Query('userId', ParseIntPipe) userId: number,
  ): Promise<PointOfInterestResponseDto[]> {
    return this.pointOfInterestService.findByGroup(groupId, userId);
  }

  @Patch(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updatePointOfInterestDto: UpdatePointOfInterestDto,
  ): Promise<PointOfInterestResponseDto> {
    return this.pointOfInterestService.update(id, updatePointOfInterestDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Param('id', ParseIntPipe) id: number,
    @Body() deletePointOfInterestDto: DeletePointOfInterestDto,
  ): Promise<void> {
    await this.pointOfInterestService.delete(
      id,
      deletePointOfInterestDto.userId,
    );
  }
}
