import { EventResponseDto } from '../dto/event-response.dto';
import { EventEntity } from '../entity/event.entity';

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
}
