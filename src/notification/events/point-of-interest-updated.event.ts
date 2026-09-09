export const POINT_OF_INTEREST_UPDATED_EVENT = 'point-of-interest.updated';

export class PointOfInterestUpdatedEvent {
  constructor(
    readonly groupId: number,
    readonly pointOfInterestId: number,
    readonly pointOfInterestName: string,
    readonly actorUserId: number,
  ) {}
}
