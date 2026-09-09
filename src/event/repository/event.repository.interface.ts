import { EventEntity } from '../entity/event.entity';
import { CreateEventData } from '../interface/create-event.interface';

export interface IEventRepository {
  findAllByMemberId(memberId: number): Promise<EventEntity[]>;
  findByIdAndMemberId(
    eventId: number,
    memberId: number,
  ): Promise<EventEntity | null>;
  create(
    data: CreateEventData,
    groupId: number,
    userId: number,
  ): Promise<EventEntity>;
}
