export interface PresenceCandidate {
  memberId: number;
  groupId: number;
  pointOfInterestId: number;
  name: string;
  radius: number;
  latitude: number;
  longitude: number;
  isInside: boolean | null;
  presenceId: number | null;
  geometryUpdatedAt: Date;
}
export interface IPointOfInterestPresenceRepository {
  findCandidates(userId: number): Promise<PresenceCandidate[]>;
  // Returns true only for a persisted transition, never for a baseline.
  save(candidate: PresenceCandidate, isInside: boolean): Promise<boolean>;
}
