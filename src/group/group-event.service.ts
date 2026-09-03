import { Injectable } from '@nestjs/common';
import { Observable, Subject } from 'rxjs';

interface GroupEventData {
  groupId: number;
  actorUserId: number;
}

export interface MemberLocationUpdatedEvent {
  event: 'memberLocationUpdated';
  data: GroupEventData & {
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
  data: GroupEventData & {
    memberId: number;
    userId: number;
  };
}

export interface MemberLocationHeartbeatEvent {
  event: 'memberLocationHeartbeat';
  data: GroupEventData & {
    memberId: number;
    userId: number;
    lastSeenAt: Date;
  };
}

export interface PointOfInterestCreatedGroupEvent {
  event: 'pointOfInterestCreated';
  data: GroupEventData & { pointOfInterestId: number };
}

export interface PointOfInterestUpdatedGroupEvent {
  event: 'pointOfInterestUpdated';
  data: GroupEventData & { pointOfInterestId: number };
}

export interface PointOfInterestDeletedGroupEvent {
  event: 'pointOfInterestDeleted';
  data: GroupEventData & { pointOfInterestId: number };
}

export type GroupEvent =
  | MemberLocationUpdatedEvent
  | MemberLocationRemovedEvent
  | MemberLocationHeartbeatEvent
  | PointOfInterestCreatedGroupEvent
  | PointOfInterestUpdatedGroupEvent
  | PointOfInterestDeletedGroupEvent;

@Injectable()
export class GroupEventService {
  private readonly eventSubject = new Subject<GroupEvent>();

  readonly events$: Observable<GroupEvent> = this.eventSubject.asObservable();

  publish(event: GroupEvent): void {
    this.eventSubject.next(event);
  }
}
