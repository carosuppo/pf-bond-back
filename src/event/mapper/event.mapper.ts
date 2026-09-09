import { CreateEventDto } from '../dto/create-event.dto';
import { EventResponseDto } from '../dto/event-response.dto';
import { EventEntity } from '../entity/event.entity';
import { CreateEventData } from '../interface/create-event.interface';

export class EventMapper {
  static toResponse(event: EventEntity): EventResponseDto {
    return {
      id: event.id,
      name: event.name,
      description: event.description,
      startAt: event.startAt,
      endAt: event.endAt,
      memberIds: event.memberIds,
    };
  }

  static toCreatePersistence(
    createEventDto: CreateEventDto,
    memberIds: number[],
  ): CreateEventData {
    return {
      name: createEventDto.name,
      description: createEventDto.description,
      startAt: createEventDto.startAt,
      endAt: createEventDto.endAt,
      memberIds,
    };
  }
}
