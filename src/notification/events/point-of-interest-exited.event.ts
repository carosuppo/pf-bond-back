export const POINT_OF_INTEREST_EXITED_EVENT = 'point-of-interest.exited';
export class PointOfInterestExitedEvent {
  constructor(
    readonly groupId: number,
    readonly pointOfInterestId: number,
    readonly pointOfInterestName: string,
    readonly actorUserId: number,
  ) {}
}
