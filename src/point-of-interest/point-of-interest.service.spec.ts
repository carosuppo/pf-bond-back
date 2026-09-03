import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { PointOfInterestService } from './point-of-interest.service';

describe('PointOfInterestService', () => {
  let service: PointOfInterestService;

  const repository = {
    create: jest.fn(),
    findByGroupId: jest.fn(),
    findByIdAndGroupId: jest.fn(),
    update: jest.fn(),
    softDelete: jest.fn(),
  };
  const memberRepository = { findByUserAndGroup: jest.fn() };
  const groupRepository = { findById: jest.fn() };
  const eventEmitter = { emit: jest.fn() };

  const location = {
    id: 9,
    latitude: -34.6037,
    longitude: -58.3816,
    accuracy: null,
    capturedAt: null,
    lastSeenAt: null,
    createdAt: new Date('2026-08-01T00:00:00Z'),
    updatedAt: new Date('2026-08-01T00:00:00Z'),
  };
  const point = {
    id: 5,
    name: 'Facultad',
    description: 'Edificio principal',
    radius: 150,
    isTemporary: false,
    endTime: null,
    locationId: 9,
    groupId: 3,
    createdAt: new Date('2026-08-01T00:00:00Z'),
    updatedAt: new Date('2026-08-01T00:00:00Z'),
    deletedAt: null,
    location,
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    groupRepository.findById.mockResolvedValue({ id: 3 });
    memberRepository.findByUserAndGroup.mockResolvedValue({ id: 10 });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PointOfInterestService,
        { provide: 'pointOfInterestRepository', useValue: repository },
        { provide: 'memberRepository', useValue: memberRepository },
        { provide: 'groupRepository', useValue: groupRepository },
        { provide: EventEmitter2, useValue: eventEmitter },
      ],
    }).compile();

    service = module.get(PointOfInterestService);
  });

  it('crea un POI sin almacenar el usuario y normaliza la descripción', async () => {
    repository.create.mockResolvedValue({ ...point, description: null });

    await service.create(3, 7, {
      name: ' Facultad ',
      description: '   ',
      radius: 150,
      latitude: -34.6037,
      longitude: -58.3816,
    });

    expect(repository.create).toHaveBeenCalledWith({
      name: 'Facultad',
      description: null,
      radius: 150,
      latitude: -34.6037,
      longitude: -58.3816,
      groupId: 3,
    });
    expect(eventEmitter.emit).toHaveBeenCalledWith(
      'point-of-interest.created',
      expect.objectContaining({
        groupId: 3,
        pointOfInterestId: 5,
        actorUserId: 7,
      }),
    );
  });

  it('rechaza crear si el usuario no pertenece al grupo', async () => {
    memberRepository.findByUserAndGroup.mockResolvedValue(null);

    await expect(
      service.create(3, 7, {
        name: 'Facultad',
        radius: 150,
        latitude: -34.6,
        longitude: -58.3,
      }),
    ).rejects.toThrow(ForbiddenException);
    expect(repository.create).not.toHaveBeenCalled();
  });

  it('rechaza operar sobre un grupo inexistente o eliminado', async () => {
    groupRepository.findById.mockResolvedValue(null);

    await expect(service.getByGroup(3, 7)).rejects.toThrow(NotFoundException);
    expect(memberRepository.findByUserAndGroup).not.toHaveBeenCalled();
  });

  it('consulta los POIs activos entregados por el repositorio', async () => {
    repository.findByGroupId.mockResolvedValue([point]);

    await expect(service.getByGroup(3, 7)).resolves.toEqual([
      {
        id: 5,
        name: 'Facultad',
        description: 'Edificio principal',
        radius: 150,
        latitude: -34.6037,
        longitude: -58.3816,
        groupId: 3,
        createdAt: point.createdAt,
      },
    ]);
    expect(repository.findByGroupId).toHaveBeenCalledWith(3);
  });

  it('actualiza todos los campos, incluida la ubicación', async () => {
    repository.findByIdAndGroupId.mockResolvedValue(point);
    repository.update.mockResolvedValue({
      ...point,
      name: 'Sede nueva',
      description: null,
      radius: 200,
      location: { ...location, latitude: -31, longitude: -60 },
    });

    const result = await service.update(3, 5, 7, {
      name: ' Sede nueva ',
      description: ' ',
      radius: 200,
      latitude: -31,
      longitude: -60,
    });

    expect(repository.update).toHaveBeenCalledWith(5, {
      name: 'Sede nueva',
      description: null,
      radius: 200,
      latitude: -31,
      longitude: -60,
    });
    expect(result.latitude).toBe(-31);
  });

  it('en una actualización parcial sólo envía los campos recibidos', async () => {
    repository.findByIdAndGroupId.mockResolvedValue(point);
    repository.update.mockResolvedValue({ ...point, name: 'Nuevo nombre' });

    await service.update(3, 5, 7, { name: 'Nuevo nombre' });

    expect(repository.update).toHaveBeenCalledWith(5, {
      name: 'Nuevo nombre',
    });
  });

  it('rechaza modificar un POI inexistente, eliminado o de otro grupo', async () => {
    repository.findByIdAndGroupId.mockResolvedValue(null);

    await expect(
      service.update(3, 99, 7, { name: 'Nuevo nombre' }),
    ).rejects.toThrow(NotFoundException);
    expect(repository.update).not.toHaveBeenCalled();
  });

  it('realiza el borrado lógico de un POI válido', async () => {
    repository.findByIdAndGroupId.mockResolvedValue(point);
    repository.softDelete.mockResolvedValue(undefined);

    await service.remove(3, 5, 7);

    expect(repository.softDelete).toHaveBeenCalledWith(5);
  });

  it('rechaza eliminar un POI inexistente o ya eliminado', async () => {
    repository.findByIdAndGroupId.mockResolvedValue(null);

    await expect(service.remove(3, 5, 7)).rejects.toThrow(NotFoundException);
    expect(repository.softDelete).not.toHaveBeenCalled();
  });
});
