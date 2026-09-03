import { PrismaService } from '../prisma/prisma.service';
import { LocationPrismaRepository } from './repository/location.prisma.repository';

describe('BND-59 - Visualizar ubicación de miembros del grupo - Repository', () => {
  let repository: LocationPrismaRepository;
  let findMany: jest.Mock;

  beforeEach(() => {
    findMany = jest.fn();

    const prisma = {
      member: {
        findMany,
      },
    } as unknown as PrismaService;

    repository = new LocationPrismaRepository(prisma);
  });

  it('consulta únicamente miembros del mismo grupo que compartan ubicación', async () => {
    findMany.mockResolvedValue([]);

    await repository.findVisibleMembers(20, 1);

    expect(findMany).toHaveBeenCalledWith({
      where: {
        groupId: 20,

        userId: {
          not: 1,
        },

        user: {
          deletedAt: null,
          currentLocation: {
            isNot: null,
          },
        },

        group: {
          deletedAt: null,
        },

        OR: [
          {
            locationSharingEnabled: true,
          },
          {
            group: {
              shareLocationMandatorily: true,
            },
          },
        ],
      },

      include: {
        user: {
          include: {
            currentLocation: true,
          },
        },
      },
    });
  });

  it('transforma los miembros visibles en ubicaciones del dominio', async () => {
    const capturedAt = new Date('2026-08-18T20:00:00Z');
    const lastSeenAt = new Date('2026-08-18T20:01:00Z');
    const createdAt = new Date();
    const updatedAt = new Date();

    findMany.mockResolvedValue([
      {
        id: 30,
        userId: 3,
        locationSharingEnabled: true,

        user: {
          id: 3,
          name: 'Juan',

          currentLocation: {
            id: 100,
            latitude: -34.6037,
            longitude: -58.3816,
            accuracy: 5,
            capturedAt,
            lastSeenAt,
            createdAt,
            updatedAt,
          },
        },
      },
    ]);

    const result = await repository.findVisibleMembers(20, 1);

    expect(result).toEqual([
      {
        memberId: 30,
        userId: 3,
        name: 'Juan',

        location: {
          id: 100,
          latitude: -34.6037,
          longitude: -58.3816,
          accuracy: 5,
          capturedAt,
          lastSeenAt,
          createdAt,
          updatedAt,
        },
      },
    ]);
  });

  it('no devuelve miembros sin ubicación aunque Prisma los entregara', async () => {
    findMany.mockResolvedValue([
      {
        id: 30,
        userId: 3,

        user: {
          name: 'Juan',
          currentLocation: null,
        },
      },
    ]);

    const result = await repository.findVisibleMembers(20, 1);

    expect(result).toEqual([]);
  });
});
