import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { NotificationService } from '../notification/notification.service';
import { CreatePointOfInterestDto } from './dto/create-point-of-interest.dto';
import { PointOfInterestResponseDto } from './dto/point-of-interest-response.dto';
import { UpdatePointOfInterestDto } from './dto/update-point-of-interest.dto';
import { PointOfInterestMapper } from './mapper/point-of-interest.mapper';
import type { IPointOfInterestRepository } from './repository/point-of-interest.repository.interface';

@Injectable()
export class PointOfInterestService {
  constructor(
    @Inject('pointOfInterestRepository')
    private readonly pointOfInterestRepository: IPointOfInterestRepository,
    private readonly notificationService: NotificationService,
  ) {}

  async create(
    dto: CreatePointOfInterestDto,
  ): Promise<PointOfInterestResponseDto> {
    const isMember = await this.pointOfInterestRepository.isMember(
      dto.userId,
      dto.groupId,
    );
    if (!isMember) {
      throw new ForbiddenException('El usuario no pertenece al grupo');
    }

    const created = await this.pointOfInterestRepository.create({
      groupId: dto.groupId,
      createdByUserId: dto.userId,
      name: dto.name,
      description: dto.description,
      radius: dto.radius,
      coordinates: `${dto.latitude},${dto.longitude}`,
    });

    this.notificationService.notifyGroupMembers(
      dto.groupId,
      `Se registró el punto de interés "${created.name}"`,
    );

    return PointOfInterestMapper.toResponse(created);
  }

  async findByGroup(
    groupId: number,
    userId: number,
  ): Promise<PointOfInterestResponseDto[]> {
    const isMember = await this.pointOfInterestRepository.isMember(
      userId,
      groupId,
    );
    if (!isMember) {
      throw new ForbiddenException('El usuario no pertenece al grupo');
    }

    const pointsOfInterest =
      await this.pointOfInterestRepository.findByGroupId(groupId);
    return pointsOfInterest.map(PointOfInterestMapper.toResponse);
  }

  async update(
    id: number,
    dto: UpdatePointOfInterestDto,
  ): Promise<PointOfInterestResponseDto> {
    const existing = await this.pointOfInterestRepository.findById(id);
    if (!existing) {
      throw new NotFoundException('Punto de interés no encontrado');
    }
    if (existing.createdByUserId !== dto.userId) {
      throw new ForbiddenException(
        'Solo el usuario que registró el punto de interés puede modificarlo',
      );
    }

    const hasNewCoordinates =
      dto.latitude !== undefined && dto.longitude !== undefined;

    const updated = await this.pointOfInterestRepository.update(id, {
      name: dto.name,
      description: dto.description,
      radius: dto.radius,
      coordinates: hasNewCoordinates
        ? `${dto.latitude},${dto.longitude}`
        : undefined,
    });

    this.notificationService.notifyGroupMembers(
      existing.groupId,
      `Se actualizó el punto de interés "${updated.name}"`,
    );

    return PointOfInterestMapper.toResponse(updated);
  }

  async delete(id: number, userId: number): Promise<void> {
    const existing = await this.pointOfInterestRepository.findById(id);
    if (!existing) {
      throw new NotFoundException('Punto de interés no encontrado');
    }
    if (existing.createdByUserId !== userId) {
      throw new ForbiddenException(
        'Solo el usuario que registró el punto de interés puede eliminarlo',
      );
    }

    await this.pointOfInterestRepository.softDelete(id);

    this.notificationService.notifyGroupMembers(
      existing.groupId,
      `Se eliminó el punto de interés "${existing.name}"`,
    );
  }
}
