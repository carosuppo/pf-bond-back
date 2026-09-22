export const EVENT_UPDATED_EVENT = 'event.updated';

export class EventUpdatedEvent {
  constructor(
    readonly groupId: number,
    readonly eventId: number,
    readonly eventName: string,
    readonly actorUserId: number,
  ) {}
}
