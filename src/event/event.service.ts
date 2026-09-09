import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { IGroupRepository } from '../group/repository/group.repository.interface';
import type { IMemberRepository } from '../member/repository/member.repository.interface';
import { CreateEventDto } from './dto/create-event.dto';
import { EventResponseDto } from './dto/event-response.dto';
import { EventMapper } from './mapper/event.mapper';
import type { IEventRepository } from './repository/event.repository.interface';
import { EventValidator } from './validator/event.validator';

@Injectable()
export class EventService {
  constructor(
    @Inject('eventRepository')
    private readonly eventRepository: IEventRepository,
    @Inject('memberRepository')
    private readonly memberRepository: IMemberRepository,
    @Inject('groupRepository')
    private readonly groupRepository: IGroupRepository,
    @Inject('eventValidator')
    private readonly eventValidator: EventValidator,
  ) {}

  async getEventsByGroup(
    groupId: number,
    userId: number,
  ): Promise<EventResponseDto[]> {
    const member = await this.memberRepository.findByUserAndGroup(
      userId,
      groupId,
    );
    if (!member) {
      throw new ForbiddenException('No perteneces a este grupo.');
    }
    const events = await this.eventRepository.findAllByMemberId(member.id);
    return events.map((event) => EventMapper.toResponse(event));
  }
  async getEventById(
    eventId: number,
    groupId: number,
    userId: number,
  ): Promise<EventResponseDto> {
    const member = await this.memberRepository.findByUserAndGroup(
      userId,
      groupId,
    );
    if (!member) {
      throw new ForbiddenException('No perteneces a este grupo.');
    }
    const event = await this.eventRepository.findByIdAndMemberId(
      eventId,
      member.id,
    );
    if (!event) {
      throw new NotFoundException('El evento no existe.');
    }
    return EventMapper.toResponse(event);
  }

  async createEvent(
    createEventDto: CreateEventDto,
    groupId: number,
    userId: number,
  ): Promise<EventResponseDto> {
    const group = await this.groupRepository.findById(groupId);

    if (!group) {
      throw new NotFoundException('El grupo no existe.');
    }

    const member = await this.memberRepository.findByUserAndGroup(
      userId,
      groupId,
    );

    if (!member) {
      throw new ForbiddenException('No perteneces a este grupo.');
    }

    if (!this.eventValidator.isFutureDate(createEventDto.startAt)) {
      throw new BadRequestException(
        'La fecha de inicio debe ser posterior a la fecha actual.',
      );
    }

    if (
      createEventDto.endAt &&
      !this.eventValidator.isAfterDate(
        createEventDto.endAt,
        createEventDto.startAt,
      )
    ) {
      throw new BadRequestException(
        'La fecha de finalización debe ser posterior a la fecha de inicio.',
      );
    }

    const memberIds = [...new Set(createEventDto.memberIds)];

    const existingMemberIds = await this.memberRepository.getMembersByIds(
      memberIds,
      groupId,
    );

    const invalidMemberIds = memberIds.filter(
      (memberId) => !existingMemberIds.includes(memberId),
    );

    if (invalidMemberIds.length > 0) {
      throw new BadRequestException(
        `Los siguientes miembros no pertenecen al grupo: ${invalidMemberIds.join(', ')}`,
      );
    }

    const persistenceData = EventMapper.toCreatePersistence(
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
}
