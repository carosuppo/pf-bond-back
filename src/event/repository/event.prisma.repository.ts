import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EventEntity } from '../entity/event.entity';
import { IEventRepository } from '../repository/event.repository.interface';

@Injectable()
export class EventPrismaRepository implements IEventRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAllByMemberId(memberId: number): Promise<EventEntity[]> {
    const events = await this.prisma.event.findMany({
      where: { deletedAt: null, members: { some: { memberId } } },
      include: { members: true },
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
    }));
  }
  async findByIdAndMemberId(
    eventId: number,
    memberId: number,
  ): Promise<EventEntity | null> {
    const event = await this.prisma.event.findFirst({
      where: { id: eventId, deletedAt: null, members: { some: { memberId } } },
      include: { members: true },
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
    };
  }
}
