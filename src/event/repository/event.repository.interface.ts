import { EventEntity } from '../entity/event.entity';
import { CreateEventData } from '../interface/create-event.interface';
import { UpdateEventData } from '../interface/update-event.interface';

export interface IEventRepository {
  findAllByMemberId(
    memberId: number,
    year: number,
    month?: number,
  ): Promise<EventEntity[]>;
  findByIdAndMemberId(
    eventId: number,
    memberId: number,
  ): Promise<EventEntity | null>;
  create(
    data: CreateEventData,
    groupId: number,
    userId: number,
  ): Promise<EventEntity>;
  update(eventId: number, data: UpdateEventData): Promise<EventEntity>;
  setLocation(
    eventId: number,
    latitude: number,
    longitude: number,
  ): Promise<EventEntity>;
}
