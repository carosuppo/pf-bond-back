import { EventEntity } from '../entity/event.entity';
import { CreateEventData } from '../interface/create-event.interface';

export interface IEventRepository {
  create(
    data: CreateEventData,
    groupId: number,
    userId: number,
  ): Promise<EventEntity>;
}
