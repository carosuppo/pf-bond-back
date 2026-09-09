import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { IGroupRepository } from '../group/repository/group.repository.interface';
import type { IMemberRepository } from '../member/repository/member.repository.interface';
import { EventResponseDto } from './dto/event-response.dto';
import { EventMapper } from './mapper/event.mapper';
import type { IEventRepository } from './repository/event.repository.interface';

@Injectable()
export class EventService {
  constructor(
    @Inject('eventRepository')
    private readonly eventRepository: IEventRepository,
    @Inject('memberRepository')
    private readonly memberRepository: IMemberRepository,
    @Inject('groupRepository')
    private readonly groupRepository: IGroupRepository,
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
}
