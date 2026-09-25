import { PrismaService } from '../../prisma/prisma.service';
import { PointOfInterestPrismaRepository } from './point-of-interest.prisma.repository';

interface PointQueryArgs {
  where: {
    id?: number;
    groupId: number;
    deletedAt: null;
    OR: Array<{
      validity: string;
      endTime?: { gt: Date };
    }>;
  };
}

interface PresenceCleanupArgs {
  where: {
    pointOfInterest: {
      groupId: number;
      validity: { not: string };
      endTime: { lte: Date };
    };
  };
}

describe('PointOfInterestPrismaRepository temporal filtering', () => {
  const findMany = jest.fn();
  const findFirst = jest.fn();
  const deleteMany = jest.fn();
  const transactionClient = {
    pointOfInterest: { findMany },
    pointOfInterestPresence: { deleteMany },
  };
  const transaction = jest.fn(
    async (callback: (client: typeof transactionClient) => Promise<unknown>) =>
      callback(transactionClient),
  );
  const prisma = {
    $transaction: transaction,
    pointOfInterest: { findFirst },
  } as unknown as PrismaService;
  const repository = new PointOfInterestPrismaRepository(prisma);

  beforeEach(() => {
    jest.clearAllMocks();
    findMany.mockResolvedValue([]);
    findFirst.mockResolvedValue(null);
    deleteMany.mockResolvedValue({ count: 0 });
  });

  it('limpia solo presencias de temporales vencidos del grupo solicitado', async () => {
    await repository.findByGroupId(3);

    const cleanupCalls = deleteMany.mock.calls as unknown as Array<
      [PresenceCleanupArgs]
    >;
    const cleanup = cleanupCalls[0][0];
    expect(cleanup.where.pointOfInterest.groupId).toBe(3);
    expect(cleanup.where.pointOfInterest.validity).toEqual({ not: 'PERMANENT' });
    expect(cleanup.where.pointOfInterest.endTime.lte).toBeInstanceOf(Date);
    expect(cleanup.where.pointOfInterest).not.toHaveProperty('deletedAt');
  });

  it('consulta los POI activos con el mismo instante usado para limpiar', async () => {
    const activePoints = [{ id: 1 }, { id: 2 }];
    findMany.mockResolvedValue(activePoints);

    const result = await repository.findByGroupId(7);
    const calls = findMany.mock.calls as unknown as Array<[PointQueryArgs]>;
    const query = calls[0][0];
    const cleanupCalls = deleteMany.mock.calls as unknown as Array<
      [PresenceCleanupArgs]
    >;
    const cleanupNow = cleanupCalls[0][0].where.pointOfInterest.endTime.lte;

    expect(result).toBe(activePoints);
    expect(query.where.groupId).toBe(7);
    expect(query.where.deletedAt).toBeNull();
    expect(query.where.OR[0]).toEqual({ validity: 'PERMANENT' });
    expect(query.where.OR[1].validity).toEqual({ not: 'PERMANENT' });
    expect(query.where.OR[1].endTime?.gt).toBe(cleanupNow);
    expect(transaction).toHaveBeenCalledTimes(1);
  });

  it('aplica el mismo filtro al resolver un destino de routing', async () => {
    await repository.findActiveByIdAndGroupId(5, 3);
    const calls = findFirst.mock.calls as unknown as Array<[PointQueryArgs]>;
    const query = calls[0][0];
    expect(query.where.id).toBe(5);
    expect(query.where.groupId).toBe(3);
    expect(query.where.OR[0]).toEqual({ validity: 'PERMANENT' });
    expect(query.where.OR[1].validity).toEqual({ not: 'PERMANENT' });
    expect(query.where.OR[1].endTime?.gt).toBeInstanceOf(Date);
  });
});
