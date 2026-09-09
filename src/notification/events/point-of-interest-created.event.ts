export const POINT_OF_INTEREST_CREATED_EVENT = 'point-of-interest.created';

export class PointOfInterestCreatedEvent {
  constructor(
    readonly groupId: number,
    readonly pointOfInterestId: number,
    readonly pointOfInterestName: string,
    readonly actorUserId: number,
  ) {}
}
