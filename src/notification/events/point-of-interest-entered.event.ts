export const POINT_OF_INTEREST_ENTERED_EVENT = 'point-of-interest.entered';
export class PointOfInterestEnteredEvent {
  constructor(
    readonly groupId: number,
    readonly pointOfInterestId: number,
    readonly pointOfInterestName: string,
    readonly actorUserId: number,
  ) {}
}
