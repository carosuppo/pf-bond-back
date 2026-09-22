export const EVENT_CANCELLED_EVENT = 'event.cancelled';

export class EventCancelledEvent {
  constructor(
    readonly groupId: number,
    readonly eventId: number,
    readonly eventName: string,
    readonly actorUserId: number,
  ) {}
}
