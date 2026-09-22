import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  EVENT_UPDATED_EVENT,
  EventUpdatedEvent,
} from '../notification/events/event-updated.event';
import { CreateEventDto } from './dto/create-event.dto';
import { EventResponseDto } from './dto/event-response.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import type { CreateEventData } from './interface/create-event.interface';
import type { UpdateEventData } from './interface/update-event.interface';
import { EventMapper } from './mapper/event.mapper';
import type { IEventRepository } from './repository/event.repository.interface';
import { EventValidator } from './validator/event.validator';

@Injectable()
export class EventService {
  constructor(
    @Inject('eventRepository')
    private readonly eventRepository: IEventRepository,
    @Inject('eventValidator')
    private readonly eventValidator: EventValidator,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async createEvent(
    createEventDto: CreateEventDto,
    groupId: number,
    userId: number,
  ): Promise<EventResponseDto> {
    await this.eventValidator.existsGroup(groupId);
    await this.eventValidator.requireMembership(userId, groupId);

    this.eventValidator.validateStartDate(createEventDto.startAt);
    this.eventValidator.validateEndDate(
      createEventDto.endAt,
      createEventDto.startAt,
    );

    const memberIds = [...new Set(createEventDto.memberIds)];

    await this.eventValidator.validateMembersBelongToGroup(memberIds, groupId);

    const persistenceData: CreateEventData = EventMapper.toCreatePersistence(
      createEventDto,
      memberIds,
    );

    const createdEvent = await this.eventRepository.create(
      persistenceData,
      groupId,
      userId,
    );

    return EventMapper.toResponse(createdEvent);
  }

  async getEventsByGroup(
    groupId: number,
    userId: number,
    year: number,
    month?: number,
  ): Promise<EventResponseDto[]> {
    const member = await this.eventValidator.requireMembership(userId, groupId);

    const events = await this.eventRepository.findAllByMemberId(
      member.id,
      year,
      month,
    );

    return events.map((event) => EventMapper.toResponse(event));
  }

  async getEventById(
    eventId: number,
    groupId: number,
    userId: number,
  ): Promise<EventResponseDto> {
    const event = await this.eventValidator.requireEventMembership(
      userId,
      groupId,
      eventId,
    );

    return EventMapper.toResponse(event);
  }

  async updateEvent(
    updateEventDto: UpdateEventDto,
    eventId: number,
    groupId: number,
    userId: number,
  ): Promise<EventResponseDto> {
    const editor = await this.eventValidator.requireMembership(userId, groupId);
    const existing = await this.eventRepository.findByIdAndMemberId(
      eventId,
      editor.id,
    );

    if (!existing) {
      throw new NotFoundException('El evento no existe.');
    }

    if (updateEventDto.startAt !== undefined) {
      this.eventValidator.validateStartDate(updateEventDto.startAt);
    }

    const startAt = updateEventDto.startAt ?? existing.startAt;
    const endAt =
      updateEventDto.endAt !== undefined
        ? updateEventDto.endAt
        : existing.endAt;

    this.eventValidator.validateEndDate(endAt, startAt);

    let memberIds: number[] | undefined;
    if (updateEventDto.memberIds !== undefined) {
      memberIds = [...new Set([editor.id, ...updateEventDto.memberIds])];
      await this.eventValidator.validateMembersBelongToGroup(
        memberIds,
        groupId,
      );
    }

    const persistenceData: UpdateEventData = {
      name: updateEventDto.name,
      description: updateEventDto.description,
      startAt: updateEventDto.startAt,
      endAt: updateEventDto.endAt,
      memberIds,
    };

    const updatedEvent = await this.eventRepository.update(
      eventId,
      persistenceData,
    );

    this.eventEmitter.emit(
      EVENT_UPDATED_EVENT,
      new EventUpdatedEvent(
        groupId,
        updatedEvent.id,
        updatedEvent.name,
        userId,
      ),
    );

    return EventMapper.toResponse(updatedEvent);
  }

  async setEventLocation(
    groupId: number,
    eventId: number,
    userId: number,
    latitude: number,
    longitude: number,
  ): Promise<EventResponseDto> {
    await this.eventValidator.requireEventMembership(userId, groupId, eventId);

    const event = await this.eventRepository.setLocation(
      eventId,
      latitude,
      longitude,
    );

    return EventMapper.toResponse(event);
  }
}
