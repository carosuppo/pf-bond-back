import { Inject, Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  POINT_OF_INTEREST_ENTERED_EVENT,
  PointOfInterestEnteredEvent,
} from '../../notification/events/point-of-interest-entered.event';
import {
  POINT_OF_INTEREST_EXITED_EVENT,
  PointOfInterestExitedEvent,
} from '../../notification/events/point-of-interest-exited.event';
import type { IPointOfInterestPresenceRepository } from './point-of-interest-presence.repository.interface';

export function distanceInMeters(
  latitude: number,
  longitude: number,
  targetLatitude: number,
  targetLongitude: number,
): number {
  const radians = (degrees: number) => (degrees * Math.PI) / 180;
  const a =
    Math.sin(radians(targetLatitude - latitude) / 2) ** 2 +
    Math.cos(radians(latitude)) *
      Math.cos(radians(targetLatitude)) *
      Math.sin(radians(targetLongitude - longitude) / 2) ** 2;
  return 6371000 * 2 * Math.asin(Math.sqrt(Math.min(1, Math.max(0, a))));
}
export function presenceState(
  distance: number,
  radius: number,
  previous: boolean | null,
): boolean {
  if (previous === null) return distance <= radius;
  const margin = Math.min(Math.max(5, radius * 0.1), 20, radius * 0.25);
  return previous ? distance < radius + margin : distance <= radius - margin;
}
@Injectable()
export class PointOfInterestPresenceService {
  constructor(
    @Inject('pointOfInterestPresenceRepository')
    private readonly repository: IPointOfInterestPresenceRepository,
    private readonly events: EventEmitter2,
  ) {}
  async evaluate(
    userId: number,
    location: { latitude: number; longitude: number },
  ): Promise<void> {
    const candidates = await this.repository.findCandidates(userId);
    for (const candidate of candidates) {
      const distance = distanceInMeters(
        location.latitude,
        location.longitude,
        candidate.latitude,
        candidate.longitude,
      );
      const inside = presenceState(
        distance,
        candidate.radius,
        candidate.isInside,
      );
      if (candidate.isInside === inside) continue;
      if (!(await this.repository.save(candidate, inside))) continue;
      const Event = inside
        ? PointOfInterestEnteredEvent
        : PointOfInterestExitedEvent;
      this.events.emit(
        inside
          ? POINT_OF_INTEREST_ENTERED_EVENT
          : POINT_OF_INTEREST_EXITED_EVENT,
        new Event(
          candidate.groupId,
          candidate.pointOfInterestId,
          candidate.name,
          userId,
        ),
      );
    }
  }
}
