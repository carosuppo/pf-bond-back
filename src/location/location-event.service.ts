import { Injectable } from '@nestjs/common';

import { Observable, Subject } from 'rxjs';

export interface MemberLocationUpdatedEvent {
  event: 'memberLocationUpdated';

  data: {
    groupId: number;
    memberId: number;
    userId: number;
    name: string;
    latitude: number;
    longitude: number;
    accuracy: number | null;
    capturedAt: Date | null;
    lastSeenAt: Date | null;
  };
}

export interface MemberLocationRemovedEvent {
  event: 'memberLocationRemoved';

  data: {
    groupId: number;
    memberId: number;
    userId: number;
  };
}

export interface MemberLocationHeartbeatEvent {
  event: 'memberLocationHeartbeat';

  data: {
    groupId: number;
    memberId: number;
    userId: number;
    lastSeenAt: Date;
  };
}

export type LocationEvent =
  | MemberLocationUpdatedEvent
  | MemberLocationRemovedEvent
  | MemberLocationHeartbeatEvent;

@Injectable()
export class LocationEventService {
  private readonly eventSubject = new Subject<LocationEvent>();

  readonly events$: Observable<LocationEvent> =
    this.eventSubject.asObservable();

  publish(event: LocationEvent): void {
    this.eventSubject.next(event);
  }
}
