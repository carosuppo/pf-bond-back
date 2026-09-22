import { PrismaService } from '../../prisma/prisma.service';
import { PointOfInterestPrismaRepository } from './point-of-interest.prisma.repository';

interface PointQueryArgs {
  where: {
    id?: number;
    groupId: number;
    deletedAt: null;
    OR: Array<{
      isTemporary: boolean;
      endTime?: { gt: Date };
    }>;
  };
}

describe('PointOfInterestPrismaRepository temporal filtering', () => {
  const findMany = jest.fn();
  const findFirst = jest.fn();
  const prisma = {
    pointOfInterest: { findMany, findFirst },
  } as unknown as PrismaService;
  const repository = new PointOfInterestPrismaRepository(prisma);

  beforeEach(() => {
    jest.clearAllMocks();
    findMany.mockResolvedValue([]);
    findFirst.mockResolvedValue(null);
  });

  it('consulta permanentes y temporales cuya expiración está en el futuro', async () => {
    await repository.findByGroupId(3);
    const calls = findMany.mock.calls as unknown as Array<[PointQueryArgs]>;
    const query = calls[0][0];
    expect(query.where.groupId).toBe(3);
    expect(query.where.deletedAt).toBeNull();
    expect(query.where.OR[0]).toEqual({ isTemporary: false });
    expect(query.where.OR[1].isTemporary).toBe(true);
    expect(query.where.OR[1].endTime?.gt).toBeInstanceOf(Date);
  });

  it('aplica el mismo filtro al resolver un destino de routing', async () => {
    await repository.findActiveByIdAndGroupId(5, 3);
    const calls = findFirst.mock.calls as unknown as Array<[PointQueryArgs]>;
    const query = calls[0][0];
    expect(query.where.id).toBe(5);
    expect(query.where.groupId).toBe(3);
    expect(query.where.OR[0]).toEqual({ isTemporary: false });
    expect(query.where.OR[1].isTemporary).toBe(true);
    expect(query.where.OR[1].endTime?.gt).toBeInstanceOf(Date);
  });
});
