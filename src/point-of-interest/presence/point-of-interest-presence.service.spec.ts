import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  PointOfInterestPresenceService,
  distanceInMeters,
  presenceState,
} from './point-of-interest-presence.service';
import {
  IPointOfInterestPresenceRepository,
  PresenceCandidate,
} from './point-of-interest-presence.repository.interface';

describe('POI presence', () => {
  let candidate: PresenceCandidate;
  let service: PointOfInterestPresenceService;
  let repository: jest.Mocked<IPointOfInterestPresenceRepository>;
  let events: EventEmitter2;
  let emit: jest.SpyInstance;
  const sample = (meters: number) => ({
    latitude: ((meters / 6371000) * 180) / Math.PI,
    longitude: 0,
  });
  beforeEach(() => {
    candidate = {
      memberId: 1,
      groupId: 3,
      pointOfInterestId: 8,
      name: 'Colegio',
      radius: 100,
      latitude: 0,
      longitude: 0,
      isInside: null,
      presenceId: null,
      geometryUpdatedAt: new Date(),
    };
    repository = {
      findCandidates: jest
        .fn()
        .mockImplementation(() => Promise.resolve([{ ...candidate }])),
      save: jest
        .fn()
        .mockImplementation(
          (_candidate: PresenceCandidate, inside: boolean) => {
            const transition = candidate.isInside !== null;
            candidate.isInside = inside;
            candidate.presenceId = 1;
            return Promise.resolve(transition);
          },
        ),
    };
    events = new EventEmitter2();
    emit = jest.spyOn(events, 'emit');
    service = new PointOfInterestPresenceService(repository, events);
  });
  it.each([0, 150])(
    'initial sample at %sm establishes a silent baseline',
    async (meters) => {
      await service.evaluate(7, sample(meters));
      expect(candidate.isInside).toBe(meters <= 100);
      expect(emit).not.toHaveBeenCalled();
    },
  );
  it('emits exactly once per persisted transition, immediately, including repeated samples', async () => {
    await service.evaluate(7, sample(150));
    for (const distance of [0, 5, 20, 0])
      await service.evaluate(7, sample(distance));
    expect(emit).toHaveBeenCalledTimes(1);
    expect(emit).toHaveBeenLastCalledWith(
      'point-of-interest.entered',
      expect.objectContaining({
        actorUserId: 7,
        groupId: 3,
        pointOfInterestId: 8,
      }),
    );
    for (const distance of [150, 160, 170])
      await service.evaluate(7, sample(distance));
    expect(emit).toHaveBeenCalledTimes(2);
    expect(emit).toHaveBeenLastCalledWith(
      'point-of-interest.exited',
      expect.objectContaining({ actorUserId: 7 }),
    );
  });
  it('keeps the previous state throughout the hysteresis band', async () => {
    await service.evaluate(7, sample(150));
    for (const distance of [109, 102, 99, 96])
      await service.evaluate(7, sample(distance));
    expect(emit).not.toHaveBeenCalled();
    await service.evaluate(7, sample(89));
    for (const distance of [94, 101, 106, 99, 109])
      await service.evaluate(7, sample(distance));
    expect(emit).toHaveBeenCalledTimes(1);
    await service.evaluate(7, sample(111));
    expect(emit).toHaveBeenCalledTimes(2);
  });
  it('does not emit when a concurrent conditional update loses', async () => {
    candidate.isInside = false;
    repository.save.mockResolvedValue(false);
    await service.evaluate(7, sample(0));
    expect(emit).not.toHaveBeenCalled();
  });
  it('does not evaluate a user without effective groups', async () => {
    repository.findCandidates.mockResolvedValue([]);
    await service.evaluate(7, sample(0));
    expect(repository.save.mock.calls).toHaveLength(0);
    expect(emit).not.toHaveBeenCalled();
  });
  it('establishes a silent baseline after sharing or geometry resets', async () => {
    await service.evaluate(7, sample(0));
    candidate.isInside = null;
    candidate.presenceId = null;
    await service.evaluate(7, sample(150));
    expect(emit).not.toHaveBeenCalled();
  });
  it('uses inclusive transition thresholds and bounded margins for small/large radii', () => {
    expect(presenceState(90, 100, false)).toBe(true);
    expect(presenceState(110, 100, true)).toBe(false);
    expect(presenceState(1.5, 2, false)).toBe(true);
    expect(presenceState(2.5, 2, true)).toBe(false);
    expect(presenceState(980, 1000, false)).toBe(true);
    expect(presenceState(1020, 1000, true)).toBe(false);
  });
  it('calculates geographic distances in meters', () => {
    expect(
      distanceInMeters(-34.6037, -58.3816, -34.6052, -58.3816),
    ).toBeCloseTo(166.79, 1);
    expect(distanceInMeters(0, 0, 0, 0)).toBe(0);
  });
});
