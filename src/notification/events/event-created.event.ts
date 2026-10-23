export const EVENT_CREATED_EVENT = 'event.created';

export class EventCreatedEvent {
  constructor(
    readonly groupId: number,
    readonly eventId: number,
    readonly eventName: string,
    readonly actorUserId: number,
  ) {}
}
