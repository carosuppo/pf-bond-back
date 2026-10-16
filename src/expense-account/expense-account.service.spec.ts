import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ExpenseAccountService } from './expense-account.service';
import { ExpenseAccountValidator } from './validator/expense-account.validator';

describe('ExpenseAccountService', () => {
  let service: ExpenseAccountService;

  const expenseAccountRepositoryMock = {
    create: jest.fn(),
    findEventById: jest.fn(),
    findEventMemberIds: jest.fn(),
    findAccountsByUserId: jest.fn(),
    findAccountById: jest.fn(),
  };

  const memberRepositoryMock = {
    findByUserAndGroup: jest.fn(),
    getMembersByIds: jest.fn(),
  };

  const groupRepositoryMock = {
    findById: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExpenseAccountService,
        ExpenseAccountValidator,
        {
          provide: 'expenseAccountRepository',
          useValue: expenseAccountRepositoryMock,
        },
        {
          provide: 'expenseAccountValidator',
          useClass: ExpenseAccountValidator,
        },
        { provide: 'memberRepository', useValue: memberRepositoryMock },
        { provide: 'groupRepository', useValue: groupRepositoryMock },
      ],
    }).compile();

    service = module.get(ExpenseAccountService);
  });

  function mockGeneralSetup(creatorId = 10) {
    groupRepositoryMock.findById.mockResolvedValue({ id: 1 });
    memberRepositoryMock.findByUserAndGroup.mockResolvedValue({
      id: creatorId,
      userId: 7,
      groupId: 1,
    });
  }

  describe('createExpenseAccount - cuenta general', () => {
    it('crea una cuenta general con nombre, grupo y miembros seleccionados', async () => {
      mockGeneralSetup();
      memberRepositoryMock.getMembersByIds.mockResolvedValue([10, 20]);
      expenseAccountRepositoryMock.create.mockResolvedValue({
        id: 1,
        name: 'Asado',
        groupId: 1,
        eventId: null,
        memberIds: [10, 20],
      });

      const result = await service.createExpenseAccount(
        { name: 'Asado', groupId: 1, memberIds: [20] },
        7,
      );

      expect(result).toEqual({
        id: 1,
        name: 'Asado',
        groupId: 1,
        eventId: null,
        memberIds: [10, 20],
      });
      expect(expenseAccountRepositoryMock.create).toHaveBeenCalledWith(
        { name: 'Asado', eventId: null, memberIds: [10, 20] },
        1,
        7,
      );
    });

    it('trata eventId null como cuenta general sin consultar el evento', async () => {
      mockGeneralSetup();
      memberRepositoryMock.getMembersByIds.mockResolvedValue([10, 20]);
      expenseAccountRepositoryMock.create.mockResolvedValue({
        id: 5,
        name: 'Asado',
        groupId: 1,
        eventId: null,
        memberIds: [10, 20],
      });

      const result = await service.createExpenseAccount(
        { name: 'Asado', groupId: 1, memberIds: [20], eventId: null },
        7,
      );

      expect(result.eventId).toBeNull();
      expect(expenseAccountRepositoryMock.findEventById).not.toHaveBeenCalled();
      expect(
        expenseAccountRepositoryMock.findEventMemberIds,
      ).not.toHaveBeenCalled();
      expect(expenseAccountRepositoryMock.create).toHaveBeenCalledWith(
        { name: 'Asado', eventId: null, memberIds: [10, 20] },
        1,
        7,
      );
    });

    it('asocia automáticamente al miembro que crea la cuenta aunque no venga en memberIds', async () => {
      mockGeneralSetup(10);
      memberRepositoryMock.getMembersByIds.mockImplementation(
        (ids: number[]) => ids,
      );
      expenseAccountRepositoryMock.create.mockImplementation(
        (data: { memberIds: number[] }) => ({
          id: 2,
          name: 'Bebidas',
          groupId: 1,
          eventId: null,
          memberIds: data.memberIds,
        }),
      );

      const result = await service.createExpenseAccount(
        { name: 'Bebidas', groupId: 1, memberIds: [20] },
        7,
      );

      expect(result.memberIds).toContain(10);
    });

    it('no duplica al creador si ya viene en memberIds', async () => {
      mockGeneralSetup(10);
      memberRepositoryMock.getMembersByIds.mockResolvedValue([10, 20]);
      expenseAccountRepositoryMock.create.mockResolvedValue({
        id: 3,
        name: 'Picada',
        groupId: 1,
        eventId: null,
        memberIds: [10, 20],
      });

      await service.createExpenseAccount(
        { name: 'Picada', groupId: 1, memberIds: [10, 20] },
        7,
      );

      expect(expenseAccountRepositoryMock.create).toHaveBeenCalledWith(
        { name: 'Picada', eventId: null, memberIds: [10, 20] },
        1,
        7,
      );
    });
  });

  describe('createExpenseAccount - cuenta vinculada a evento', () => {
    it('crea una cuenta vinculada a un evento con miembros del evento', async () => {
      mockGeneralSetup(10);
      memberRepositoryMock.getMembersByIds.mockResolvedValue([10, 20]);
      expenseAccountRepositoryMock.findEventById.mockResolvedValue({
        id: 5,
        groupId: 1,
        deletedAt: null,
      });
      expenseAccountRepositoryMock.findEventMemberIds.mockResolvedValue([
        10, 20, 30,
      ]);
      expenseAccountRepositoryMock.create.mockResolvedValue({
        id: 4,
        name: 'Viaje',
        groupId: 1,
        eventId: 5,
        memberIds: [10, 20],
      });

      const result = await service.createExpenseAccount(
        { name: 'Viaje', groupId: 1, memberIds: [20], eventId: 5 },
        7,
      );

      expect(result.eventId).toBe(5);
      expect(result.memberIds).toEqual([10, 20]);
    });

    it('falla si el evento pertenece a otro grupo', async () => {
      mockGeneralSetup();
      memberRepositoryMock.getMembersByIds.mockResolvedValue([10, 20]);
      expenseAccountRepositoryMock.findEventById.mockResolvedValue({
        id: 9,
        groupId: 2,
        deletedAt: null,
      });

      const attempt = service.createExpenseAccount(
        { name: 'Viaje', groupId: 1, memberIds: [20], eventId: 9 },
        7,
      );

      await expect(attempt).rejects.toThrow(BadRequestException);
      await expect(attempt).rejects.toThrow(
        'El evento pertenece a otro grupo.',
      );
      expect(expenseAccountRepositoryMock.create).not.toHaveBeenCalled();
    });

    it('falla si el evento no existe', async () => {
      mockGeneralSetup();
      memberRepositoryMock.getMembersByIds.mockResolvedValue([10, 20]);
      expenseAccountRepositoryMock.findEventById.mockResolvedValue(null);

      const attempt = service.createExpenseAccount(
        { name: 'Viaje', groupId: 1, memberIds: [20], eventId: 999 },
        7,
      );

      await expect(attempt).rejects.toThrow(NotFoundException);
      await expect(attempt).rejects.toThrow('El evento no existe.');
      expect(expenseAccountRepositoryMock.create).not.toHaveBeenCalled();
    });

    it('falla si un miembro no pertenece al evento', async () => {
      mockGeneralSetup(10);
      memberRepositoryMock.getMembersByIds.mockResolvedValue([10, 20]);
      expenseAccountRepositoryMock.findEventById.mockResolvedValue({
        id: 5,
        groupId: 1,
        deletedAt: null,
      });
      expenseAccountRepositoryMock.findEventMemberIds.mockResolvedValue([10]);

      const attempt = service.createExpenseAccount(
        { name: 'Viaje', groupId: 1, memberIds: [20], eventId: 5 },
        7,
      );

      await expect(attempt).rejects.toThrow(BadRequestException);
      await expect(attempt).rejects.toThrow(
        'Los siguientes miembros no pertenecen al evento: 20',
      );
      expect(expenseAccountRepositoryMock.create).not.toHaveBeenCalled();
    });
  });

  describe('createExpenseAccount - validaciones de grupo y miembros', () => {
    it('falla si quien crea no es miembro del grupo', async () => {
      groupRepositoryMock.findById.mockResolvedValue({ id: 1 });
      memberRepositoryMock.findByUserAndGroup.mockResolvedValue(null);

      const attempt = service.createExpenseAccount(
        { name: 'Asado', groupId: 1, memberIds: [20] },
        7,
      );

      await expect(attempt).rejects.toThrow(ForbiddenException);
      await expect(attempt).rejects.toThrow('No perteneces a este grupo.');
      expect(expenseAccountRepositoryMock.create).not.toHaveBeenCalled();
    });

    it('falla si el grupo no existe', async () => {
      groupRepositoryMock.findById.mockResolvedValue(null);

      const attempt = service.createExpenseAccount(
        { name: 'Asado', memberIds: [20] },
        999,
        7,
      );

      await expect(attempt).rejects.toThrow(NotFoundException);
      await expect(attempt).rejects.toThrow('El grupo no existe.');
      expect(expenseAccountRepositoryMock.create).not.toHaveBeenCalled();
    });

    it('falla si se asocia a una persona que no pertenece al grupo', async () => {
      mockGeneralSetup(10);
      memberRepositoryMock.getMembersByIds.mockResolvedValue([10]);

      const attempt = service.createExpenseAccount(
        { name: 'Asado', groupId: 1, memberIds: [99] },
        7,
      );

      await expect(attempt).rejects.toThrow(BadRequestException);
      await expect(attempt).rejects.toThrow(
        'Los siguientes miembros no pertenecen al grupo: 99',
      );
      expect(expenseAccountRepositoryMock.create).not.toHaveBeenCalled();
    });
  });

  describe('getMyAccounts', () => {
    it('lista las cuentas asociadas con grupo, evento y saldo saldado', async () => {
      expenseAccountRepositoryMock.findAccountsByUserId.mockResolvedValue([
        {
          id: 1,
          name: 'Asado',
          groupId: 1,
          groupName: 'Familia',
          eventId: null,
          eventName: null,
          memberIds: [10, 20],
          myMemberId: 10,
          movements: [],
        },
        {
          id: 2,
          name: 'Viaje',
          groupId: 1,
          groupName: 'Familia',
          eventId: 5,
          eventName: 'Bariloche',
          memberIds: [10, 30],
          myMemberId: 10,
          movements: [],
        },
      ]);

      const result = await service.getMyAccounts(7);

      expect(
        expenseAccountRepositoryMock.findAccountsByUserId,
      ).toHaveBeenCalledWith(7);
      expect(result).toEqual([
        {
          id: 1,
          name: 'Asado',
          groupId: 1,
          groupName: 'Familia',
          eventId: null,
          eventName: null,
          balanceCents: 0,
          status: 'SALDADO',
        },
        {
          id: 2,
          name: 'Viaje',
          groupId: 1,
          groupName: 'Familia',
          eventId: 5,
          eventName: 'Bariloche',
          balanceCents: 0,
          status: 'SALDADO',
        },
      ]);
    });

    it('devuelve una lista vacía si el miembro no está asociado a ninguna cuenta', async () => {
      expenseAccountRepositoryMock.findAccountsByUserId.mockResolvedValue([]);

      const result = await service.getMyAccounts(7);

      expect(result).toEqual([]);
    });
  });

  describe('getAccountDetail', () => {
    it('devuelve el detalle con saldos, deudas y movimientos', async () => {
      expenseAccountRepositoryMock.findAccountById.mockResolvedValue({
        id: 1,
        name: 'Asado',
        groupId: 1,
        groupName: 'Familia',
        eventId: null,
        eventName: null,
        memberIds: [10, 20],
        movements: [],
      });
      memberRepositoryMock.findByUserAndGroup.mockResolvedValue({
        id: 10,
        userId: 7,
        groupId: 1,
      });

      const result = await service.getAccountDetail(1, 7);

      expect(result).toEqual({
        id: 1,
        name: 'Asado',
        groupId: 1,
        groupName: 'Familia',
        eventId: null,
        eventName: null,
        members: [
          { memberId: 10, balanceCents: 0, status: 'SALDADO' },
          { memberId: 20, balanceCents: 0, status: 'SALDADO' },
        ],
        myBalanceCents: 0,
        myStatus: 'SALDADO',
        debtsToMe: [],
        myDebts: [],
        movements: [],
      });
    });

    it('falla si la cuenta no existe', async () => {
      expenseAccountRepositoryMock.findAccountById.mockResolvedValue(null);

      const attempt = service.getAccountDetail(999, 7);

      await expect(attempt).rejects.toThrow(NotFoundException);
      await expect(attempt).rejects.toThrow('La cuenta no existe.');
    });

    it('falla si el miembro no está asociado a la cuenta', async () => {
      expenseAccountRepositoryMock.findAccountById.mockResolvedValue({
        id: 1,
        name: 'Asado',
        groupId: 1,
        groupName: 'Familia',
        eventId: null,
        eventName: null,
        memberIds: [10, 20],
        movements: [],
      });
      memberRepositoryMock.findByUserAndGroup.mockResolvedValue({
        id: 30,
        userId: 7,
        groupId: 1,
      });

      const attempt = service.getAccountDetail(1, 7);

      await expect(attempt).rejects.toThrow(ForbiddenException);
      await expect(attempt).rejects.toThrow('No estás asociado a esta cuenta.');
    });

    it('falla si el usuario no pertenece al grupo de la cuenta', async () => {
      expenseAccountRepositoryMock.findAccountById.mockResolvedValue({
        id: 1,
        name: 'Asado',
        groupId: 1,
        groupName: 'Familia',
        eventId: null,
        eventName: null,
        memberIds: [10, 20],
        movements: [],
      });
      memberRepositoryMock.findByUserAndGroup.mockResolvedValue(null);

      const attempt = service.getAccountDetail(1, 7);

      await expect(attempt).rejects.toThrow(ForbiddenException);
      await expect(attempt).rejects.toThrow('No estás asociado a esta cuenta.');
    });
  });
});
