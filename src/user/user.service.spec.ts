import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { User } from '@prisma/client';
import { MailService } from '../mail/mail.service';
import { UpdateUserDto } from './dto/update-user.dto';
import type { IEmailVerificationTokenRepository } from './repository/email-verification-token.repository.interface';
import type { IUserSessionRepository } from './repository/user-session.repository.interface';
import type { IUserRepository } from './repository/user.repository.interface';
import { UserService } from './user.service';

describe('UserService.update', () => {
  const buildUser = (overrides: Partial<User> = {}): User => ({
    id: 1,
    name: 'Nombre',
    email: 'usuario@mail.com',
    passwordHash: 'hash',
    locationId: null,
    emailVerifiedAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    ...overrides,
  });

  const createService = (
    userRepository: Partial<IUserRepository>,
  ): UserService =>
    new UserService(
      userRepository as unknown as IUserRepository,
      {} as unknown as IUserSessionRepository,
      {} as unknown as IEmailVerificationTokenRepository,
      {} as unknown as MailService,
      {} as unknown as ConfigService,
    );

  it('actualiza nombre y correo con datos válidos', async () => {
    const updatedUser = buildUser({
      name: 'Nuevo Nombre',
      email: 'nuevo@mail.com',
    });

    const userRepository: Partial<IUserRepository> = {
      findByEmail: jest.fn().mockResolvedValue(null),
      update: jest.fn().mockResolvedValue(updatedUser),
    };

    const service = createService(userRepository);
    const dto: UpdateUserDto = {
      name: 'Nuevo Nombre',
      email: 'nuevo@mail.com',
    };

    const result = await service.update(1, dto);

    expect(userRepository.update).toHaveBeenCalledWith(1, {
      name: 'Nuevo Nombre',
      email: 'nuevo@mail.com',
    });
    expect(result).toEqual({
      id: updatedUser.id,
      name: updatedUser.name,
      email: updatedUser.email,
      locationId: updatedUser.locationId,
      createdAt: updatedUser.createdAt,
      updatedAt: updatedUser.updatedAt,
    });
  });

  it('actualiza únicamente el campo nombre', async () => {
    const updatedUser = buildUser({ name: 'Solo Nombre' });

    const userRepository: Partial<IUserRepository> = {
      update: jest.fn().mockResolvedValue(updatedUser),
    };

    const service = createService(userRepository);

    await service.update(1, { name: 'Solo Nombre' });

    expect(userRepository.findByEmail).toBeUndefined();
    expect(userRepository.update).toHaveBeenCalledWith(1, {
      name: 'Solo Nombre',
    });
  });

  it('lanza ConflictException cuando el correo ya está registrado', async () => {
    const existingUser = buildUser({ id: 2, email: 'ocupado@mail.com' });

    const userRepository: Partial<IUserRepository> = {
      findByEmail: jest.fn().mockResolvedValue(existingUser),
    };

    const service = createService(userRepository);

    await expect(
      service.update(1, { email: 'ocupado@mail.com' }),
    ).rejects.toThrow(ConflictException);
  });

  it('lanza BadRequestException cuando no se envía ningún campo', async () => {
    const userRepository: Partial<IUserRepository> = {};
    const service = createService(userRepository);

    await expect(service.update(1, {})).rejects.toThrow(BadRequestException);
  });

  it('permite conservar el correo propio', async () => {
    const sameUser = buildUser({ id: 1 });
    const updatedUser = buildUser({ name: 'Nuevo' });

    const userRepository: Partial<IUserRepository> = {
      findByEmail: jest.fn().mockResolvedValue(sameUser),
      update: jest.fn().mockResolvedValue(updatedUser),
    };

    const service = createService(userRepository);

    await service.update(1, { name: 'Nuevo', email: 'usuario@mail.com' });

    expect(userRepository.update).toHaveBeenCalledWith(1, {
      name: 'Nuevo',
      email: 'usuario@mail.com',
    });
  });
});

describe('UserService.getProfile', () => {
  const buildUser = (overrides: Partial<User> = {}): User => ({
    id: 1,
    name: 'Nombre',
    email: 'usuario@mail.com',
    passwordHash: 'hash',
    locationId: null,
    emailVerifiedAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    ...overrides,
  });

  const createService = (
    userRepository: Partial<IUserRepository>,
  ): UserService =>
    new UserService(
      userRepository as unknown as IUserRepository,
      {} as unknown as IUserSessionRepository,
      {} as unknown as IEmailVerificationTokenRepository,
      {} as unknown as MailService,
      {} as unknown as ConfigService,
    );

  it('devuelve nombre, correo y listado de grupos del usuario', async () => {
    const user = buildUser();
    const groups = [
      { id: 2, name: 'Amigos' },
      { id: 3, name: 'Familia' },
    ];

    const userRepository: Partial<IUserRepository> = {
      findById: jest.fn().mockResolvedValue(user),
      findGroupsByUserId: jest.fn().mockResolvedValue(groups),
    };

    const service = createService(userRepository);

    const result = await service.getProfile(1);

    expect(userRepository.findById).toHaveBeenCalledWith(1);
    expect(userRepository.findGroupsByUserId).toHaveBeenCalledWith(1);
    expect(result).toEqual({
      id: user.id,
      name: user.name,
      email: user.email,
      profilePhoto: null,
      groups,
    });
  });

  it('devuelve una lista de grupos vacía cuando no pertenece a ningún grupo', async () => {
    const userRepository: Partial<IUserRepository> = {
      findById: jest.fn().mockResolvedValue(buildUser()),
      findGroupsByUserId: jest.fn().mockResolvedValue([]),
    };

    const service = createService(userRepository);

    const result = await service.getProfile(1);

    expect(result.name).toBe('Nombre');
    expect(result.email).toBe('usuario@mail.com');
    expect(result.groups).toEqual([]);
  });

  it('lanza NotFoundException cuando el usuario no existe', async () => {
    const userRepository: Partial<IUserRepository> = {
      findById: jest.fn().mockResolvedValue(null),
    };

    const service = createService(userRepository);

    await expect(service.getProfile(1)).rejects.toThrow(NotFoundException);
  });
});
