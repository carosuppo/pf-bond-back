import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EventEntity } from '../entity/event.entity';
import { IEventRepository } from '../repository/event.repository.interface';

@Injectable()
export class EventPrismaRepository implements IEventRepository {
  constructor(private readonly prismaService: PrismaService) {}

  async findAllByMemberId(
    memberId: number,
    year: number,
  ): Promise<EventEntity[]> {
    const events = await this.prismaService.event.findMany({
      where: {
        deletedAt: null,
        members: { some: { memberId } },
        OR: [
          {
            startAt: {
              gte: new Date(year, 0, 1),
              lte: new Date(year, 11, 31, 23, 59, 59, 999),
            },
          },
          {
            endAt: {
              gte: new Date(year, 0, 1),
              lte: new Date(year, 11, 31, 23, 59, 59, 999),
            },
          },
        ],
      },
      include: { members: true, location: true },
      orderBy: { startAt: 'asc' },
    });
    return events.map((event) => ({
      id: event.id,
      name: event.name,
      description: event.description,
      startAt: event.startAt,
      endAt: event.endAt,
      groupId: event.groupId,
      memberIds: event.members.map((eventMember) => eventMember.memberId),
      location: event.location
        ? {
            latitude: event.location.latitude,
            longitude: event.location.longitude,
          }
        : null,
    }));
  }

  async findByIdAndMemberId(
    eventId: number,
    memberId: number,
  ): Promise<EventEntity | null> {
    const event = await this.prismaService.event.findFirst({
      where: { id: eventId, deletedAt: null, members: { some: { memberId } } },
      include: { members: true, location: true },
    });

    if (!event) {
      return null;
    }

    return {
      id: event.id,
      name: event.name,
      description: event.description,
      startAt: event.startAt,
      endAt: event.endAt,
      groupId: event.groupId,
      memberIds: event.members.map((eventMember) => eventMember.memberId),
      location: event.location
        ? {
            latitude: event.location.latitude,
            longitude: event.location.longitude,
          }
        : null,
    };
  }

  async setLocation(
    eventId: number,
    latitude: number,
    longitude: number,
  ): Promise<EventEntity> {
    return this.prismaService.$transaction(async (transaction) => {
      const event = await transaction.event.findUniqueOrThrow({
        where: { id: eventId },
        select: { locationId: true },
      });

      if (event.locationId !== null) {
        await transaction.location.update({
          where: { id: event.locationId },
          data: { latitude, longitude },
        });
      } else {
        const location = await transaction.location.create({
          data: { latitude, longitude },
        });

        await transaction.event.update({
          where: { id: eventId },
          data: { locationId: location.id },
        });
      }

      const updatedEvent = await transaction.event.findUniqueOrThrow({
        where: { id: eventId },
        include: { members: true, location: true },
      });

      return {
        id: updatedEvent.id,
        name: updatedEvent.name,
        description: updatedEvent.description,
        startAt: updatedEvent.startAt,
        endAt: updatedEvent.endAt,
        groupId: updatedEvent.groupId,
        memberIds: updatedEvent.members.map((member) => member.memberId),
        location: updatedEvent.location
          ? {
              latitude: updatedEvent.location.latitude,
              longitude: updatedEvent.location.longitude,
            }
          : null,
      };
    });
  }
}
