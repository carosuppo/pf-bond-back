import { CreateEventData } from '../interface/create-event.interface';
import { EventRecurrenceDto } from '../dto/event-recurrence.dto';
import { EventEntity } from '../entity/event.entity';

export interface IEventRecurrenceRepository {
  create(
    data: CreateEventData,
    recurrence: EventRecurrenceDto,
    groupId: number,
    userId: number,
  ): Promise<EventEntity>;
  ensure(from: Date, through: Date, groupId?: number): Promise<void>;
}
