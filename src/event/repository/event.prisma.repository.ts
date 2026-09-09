import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EventEntity } from '../entity/event.entity';
import { CreateEventData } from '../interface/create-event.interface';
import { IEventRepository } from '../repository/event.repository.interface';

@Injectable()
export class EventPrismaRepository implements IEventRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    data: CreateEventData,
    groupId: number,
    userId: number,
  ): Promise<EventEntity> {
    return this.prisma.$transaction(async (tx) => {
      const creator = await tx.member.findUniqueOrThrow({
        where: {
          userId_groupId: {
            userId,
            groupId,
          },
        },
      });

      const memberIds = [...new Set([creator.id, ...data.memberIds])];

      const event = await tx.event.create({
        data: {
          name: data.name,
          description: data.description,
          startAt: data.startAt,
          endAt: data.endAt,
          groupId,
          members: {
            create: memberIds.map((memberId) => ({
              memberId,
            })),
          },
        },
        include: {
          members: true,
        },
      });

      return {
        id: event.id,
        name: event.name,
        description: event.description,
        startAt: event.startAt,
        endAt: event.endAt,
        groupId: event.groupId,
        memberIds: event.members.map((eventMember) => eventMember.memberId),
      };
    });
  }

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
