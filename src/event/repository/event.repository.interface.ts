import { EventEntity } from '../entity/event.entity';

export interface IEventRepository {
  findAllByMemberId(memberId: number): Promise<EventEntity[]>;
  findByIdAndMemberId(
    eventId: number,
    memberId: number,
  ): Promise<EventEntity | null>;
}
