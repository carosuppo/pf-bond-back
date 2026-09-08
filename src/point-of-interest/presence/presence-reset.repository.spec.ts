import { PrismaService } from '../../prisma/prisma.service';
import { LocationPrismaRepository } from '../../location/repository/location.prisma.repository';
import { GroupPrismaRepository } from '../../group/repository/group.prisma.repository';
import { IMemberRepository } from '../../member/repository/member.repository.interface';
import { PointOfInterestPrismaRepository } from '../repository/point-of-interest.prisma.repository';
import { PointOfInterestPresencePrismaRepository } from './point-of-interest-presence.prisma.repository';
import { PresenceCandidate } from './point-of-interest-presence.repository.interface';

describe('Presence persistence and reset', () => {
  const point = {
    id: 8,
    locationId: 4,
    radius: 100,
    location: { latitude: 1, longitude: 2 },
  };
  const tx = {
    $queryRaw: jest.fn().mockResolvedValue([]),
    member: { update: jest.fn(), findFirst: jest.fn() },
    group: { update: jest.fn() },
    pointOfInterest: {
      findUniqueOrThrow: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn<Promise<unknown>, [unknown]>(),
    },
    location: { update: jest.fn() },
    pointOfInterestPresence: {
      deleteMany: jest.fn(),
      createMany: jest.fn(),
      updateMany: jest.fn(),
    },
  };
  const findMany = jest.fn();
  const prisma = {
    $transaction: (work: (value: typeof tx) => Promise<unknown>) => work(tx),
    member: { findMany },
  } as unknown as PrismaService;
  beforeEach(() => {
    jest.clearAllMocks();
    tx.pointOfInterest.findUniqueOrThrow.mockResolvedValue(point);
    tx.member.update.mockResolvedValue({
      group: { shareLocationMandatorily: false },
    });
    tx.group.update.mockResolvedValue({});
    tx.member.findFirst.mockResolvedValue({ id: 1 });
    tx.pointOfInterest.findFirst.mockResolvedValue({ id: 8 });
    tx.pointOfInterestPresence.updateMany.mockResolvedValue({ count: 1 });
  });
  it('clears baseline in the same transaction when optional sharing is disabled', async () => {
    await new LocationPrismaRepository(prisma).updateMemberSharing(1, false);
    expect(tx.pointOfInterestPresence.deleteMany).toHaveBeenCalledWith({
      where: { memberId: 1 },
    });
  });
  it('keeps baseline while mandatory sharing is still effective', async () => {
    tx.member.update.mockResolvedValue({
      group: { shareLocationMandatorily: true },
    });
    await new LocationPrismaRepository(prisma).updateMemberSharing(1, false);
    expect(tx.pointOfInterestPresence.deleteMany).not.toHaveBeenCalled();
  });
  it('enabling personal sharing does not fabricate a transition', async () => {
    await new LocationPrismaRepository(prisma).updateMemberSharing(1, true);
    expect(tx.pointOfInterestPresence.deleteMany).not.toHaveBeenCalled();
  });
  it('turning off mandatory sharing clears only members without personal sharing', async () => {
    await new GroupPrismaRepository(prisma, {} as IMemberRepository).update(3, {
      shareLocationMandatorily: false,
    });
    expect(tx.pointOfInterestPresence.deleteMany).toHaveBeenCalledWith({
      where: { member: { groupId: 3, locationSharingEnabled: false } },
    });
  });
  it.each([{ radius: 200 }, { latitude: 3 }, { longitude: 4 }])(
    'geometry change %j clears baseline',
    async (change) => {
      await new PointOfInterestPrismaRepository(prisma).update(8, change);
      expect(tx.pointOfInterestPresence.deleteMany).toHaveBeenCalledWith({
        where: { pointOfInterestId: 8 },
      });
    },
  );
  it.each([
    { name: 'Otro nombre' },
    { description: 'Nueva descripción' },
    { radius: 100, latitude: 1, longitude: 2 },
  ])('non-geometric change %j retains baseline', async (change) => {
    await new PointOfInterestPrismaRepository(prisma).update(8, change);
    expect(tx.pointOfInterestPresence.deleteMany).not.toHaveBeenCalled();
  });
  it('soft delete cleans presences', async () => {
    await new PointOfInterestPrismaRepository(prisma).softDelete(8);
    expect(tx.pointOfInterest.update.mock.calls[0][0]).toMatchObject({
      where: { id: 8 },
    });
    expect(tx.pointOfInterestPresence.deleteMany).toHaveBeenCalledWith({
      where: { pointOfInterestId: 8 },
    });
  });
  it('queries only effective memberships and active POIs', async () => {
    findMany.mockResolvedValue([]);
    await new PointOfInterestPresencePrismaRepository(prisma).findCandidates(7);
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId: 7,
          user: { deletedAt: null },
          group: { deletedAt: null },
          OR: [
            { locationSharingEnabled: true },
            { group: { shareLocationMandatorily: true } },
          ],
        },
      }),
    );
  });
  const candidate: PresenceCandidate = {
    memberId: 1,
    groupId: 3,
    pointOfInterestId: 8,
    name: 'Colegio',
    radius: 100,
    latitude: 1,
    longitude: 2,
    isInside: false,
    presenceId: 20,
    geometryUpdatedAt: new Date(),
  };
  it('uses unique insert for baseline and never emits a transition', async () => {
    expect(
      await new PointOfInterestPresencePrismaRepository(prisma).save(
        { ...candidate, isInside: null, presenceId: null },
        true,
      ),
    ).toBe(false);
    expect(tx.pointOfInterestPresence.createMany).toHaveBeenCalledWith({
      data: { memberId: 1, pointOfInterestId: 8, isInside: true },
      skipDuplicates: true,
    });
  });
  it('conditional update prevents duplicate transition and stale baseline resurrection', async () => {
    const repository = new PointOfInterestPresencePrismaRepository(prisma);
    expect(await repository.save(candidate, true)).toBe(true);
    expect(tx.pointOfInterestPresence.updateMany).toHaveBeenCalledWith({
      where: { id: 20, isInside: false },
      data: { isInside: true },
    });
    tx.pointOfInterestPresence.updateMany.mockResolvedValue({ count: 0 });
    expect(await repository.save(candidate, true)).toBe(false);
  });
  it('rechecks sharing and geometry after locking before persisting', async () => {
    tx.member.findFirst.mockResolvedValue(null);
    expect(
      await new PointOfInterestPresencePrismaRepository(prisma).save(
        candidate,
        true,
      ),
    ).toBe(false);
    expect(tx.pointOfInterestPresence.updateMany).not.toHaveBeenCalled();
    tx.member.findFirst.mockResolvedValue({ id: 1 });
    tx.pointOfInterest.findFirst.mockResolvedValue(null);
    expect(
      await new PointOfInterestPresencePrismaRepository(prisma).save(
        candidate,
        true,
      ),
    ).toBe(false);
    expect(tx.pointOfInterestPresence.updateMany).not.toHaveBeenCalled();
  });
});
