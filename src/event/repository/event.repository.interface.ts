import { EventEntity } from '../entity/event.entity';

export interface IEventRepository {
  findAllByMemberId(memberId: number, year: number): Promise<EventEntity[]>;
  findByIdAndMemberId(
    eventId: number,
    memberId: number,
  ): Promise<EventEntity | null>;
  setLocation(
    eventId: number,
    latitude: number,
    longitude: number,
  ): Promise<EventEntity>;
}
