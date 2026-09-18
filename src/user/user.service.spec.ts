import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { User } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { MailService } from '../mail/mail.service';
import { MAX_PROFILE_PHOTO_SIZE } from './constants/profile-photo.constants';
import { UpdateUserDto } from './dto/update-user.dto';
import { ProfilePhotoFile } from './interface/profile-photo-file.interface';
import { SupabaseStorageService } from './storage/supabase-storage.service';
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
    profilePhoto: null,
    profilePhotoPath: null,
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
      {} as unknown as SupabaseStorageService,
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
      profilePhoto: updatedUser.profilePhoto,
      locationId: updatedUser.locationId,
      groups: [],
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

describe('UserService.changePassword', () => {
  const rawPassword = 'claveActual1';
  let passwordHash: string;

  beforeAll(async () => {
    passwordHash = await bcrypt.hash(rawPassword, 12);
  });

  const buildUser = (overrides: Partial<User> = {}): User => ({
    id: 1,
    name: 'Nombre',
    email: 'usuario@mail.com',
    passwordHash,
    profilePhoto: null,
    profilePhotoPath: null,
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
      {} as unknown as SupabaseStorageService,
    );

  it('cambia la contraseña con una nueva contraseña válida', async () => {
    const userRepository: Partial<IUserRepository> = {
      findById: jest.fn().mockResolvedValue(buildUser()),
      updatePassword: jest.fn().mockResolvedValue(buildUser()),
    };

    const service = createService(userRepository);

    const result = await service.changePassword(1, {
      currentPassword: rawPassword,
      newPassword: 'nuevaClave123',
    });

    expect(userRepository.updatePassword).toHaveBeenCalledTimes(1);
    expect(userRepository.updatePassword).toHaveBeenCalledWith(
      1,
      expect.any(String),
    );
    expect(result).toEqual({
      message: 'Contraseña actualizada correctamente.',
    });
  });

  it('lanza UnauthorizedException si la contraseña actual es incorrecta', async () => {
    const userRepository: Partial<IUserRepository> = {
      findById: jest.fn().mockResolvedValue(buildUser()),
    };

    const service = createService(userRepository);

    await expect(
      service.changePassword(1, {
        currentPassword: 'incorrecta1',
        newPassword: 'nuevaClave123',
      }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('lanza BadRequestException si la nueva contraseña es igual a la actual', async () => {
    const userRepository: Partial<IUserRepository> = {
      findById: jest.fn().mockResolvedValue(buildUser()),
    };

    const service = createService(userRepository);

    await expect(
      service.changePassword(1, {
        currentPassword: rawPassword,
        newPassword: rawPassword,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('lanza NotFoundException si el usuario no existe', async () => {
    const userRepository: Partial<IUserRepository> = {
      findById: jest.fn().mockResolvedValue(null),
    };

    const service = createService(userRepository);

    await expect(
      service.changePassword(1, {
        currentPassword: rawPassword,
        newPassword: 'nuevaClave123',
      }),
    ).rejects.toThrow(NotFoundException);
  });
});

describe('UserService.updateProfilePhoto', () => {
  const buildUser = (overrides: Partial<User> = {}): User => ({
    id: 1,
    name: 'Nombre',
    email: 'usuario@mail.com',
    passwordHash: 'hash',
    profilePhoto: null,
    profilePhotoPath: null,
    locationId: null,
    emailVerifiedAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    ...overrides,
  });

  const createService = (
    userRepository: Partial<IUserRepository>,
    storage: Partial<SupabaseStorageService> = {},
  ): UserService =>
    new UserService(
      userRepository as unknown as IUserRepository,
      {} as unknown as IUserSessionRepository,
      {} as unknown as IEmailVerificationTokenRepository,
      {} as unknown as MailService,
      {} as unknown as ConfigService,
      storage as unknown as SupabaseStorageService,
    );

  it('guarda una imagen JPEG válida y la devuelve en la respuesta', async () => {
    const updatedUser = buildUser({
      profilePhoto: 'https://supabase.co/profile-new.jpg',
      profilePhotoPath: 'users/1/new.jpg',
    });
    const userRepository: Partial<IUserRepository> = {
      findById: jest
        .fn()
        .mockResolvedValue(buildUser({ profilePhotoPath: 'users/1/old.jpg' })),
      updateProfilePhoto: jest.fn().mockResolvedValue(updatedUser),
    };
    const storage: Partial<SupabaseStorageService> = {
      upload: jest
        .fn()
        .mockResolvedValue('https://supabase.co/profile-new.jpg'),
      remove: jest.fn().mockResolvedValue(undefined),
    };
    const service = createService(userRepository, storage);
    const file: ProfilePhotoFile = {
      mimetype: 'image/jpeg',
      buffer: Buffer.from([0xff, 0xd8, 0xff, 0x00]),
    };

    const result = await service.updateProfilePhoto(1, file);

    expect(storage.upload).toHaveBeenCalledWith(
      expect.stringMatching(/^users\/1\/[\w-]+\.jpg$/),
      file.buffer,
      file.mimetype,
    );
    expect(userRepository.updateProfilePhoto).toHaveBeenCalledWith(
      1,
      'https://supabase.co/profile-new.jpg',
      expect.stringMatching(/^users\/1\/[\w-]+\.jpg$/),
    );
    expect(storage.remove).toHaveBeenCalledWith('users/1/old.jpg');
    expect(result.profilePhoto).toBe('https://supabase.co/profile-new.jpg');
  });

  it('rechaza un formato no permitido', async () => {
    const service = createService({});
    const file: ProfilePhotoFile = {
      mimetype: 'image/gif',
      buffer: Buffer.from('GIF89a'),
    };

    await expect(service.updateProfilePhoto(1, file)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('rechaza una imagen que supera el tamaño máximo', async () => {
    const service = createService({});
    const file: ProfilePhotoFile = {
      mimetype: 'image/jpeg',
      buffer: Buffer.alloc(MAX_PROFILE_PHOTO_SIZE + 1),
    };

    await expect(service.updateProfilePhoto(1, file)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('rechaza un archivo cuyo contenido no coincide con su MIME', async () => {
    const service = createService({});
    const file: ProfilePhotoFile = {
      mimetype: 'image/png',
      buffer: Buffer.from('no es png'),
    };

    await expect(service.updateProfilePhoto(1, file)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('no modifica la foto actual cuando no se envía un archivo', async () => {
    const updateProfilePhoto = jest.fn();
    const service = createService({ updateProfilePhoto });

    await expect(service.updateProfilePhoto(1, undefined)).rejects.toThrow(
      BadRequestException,
    );
    expect(updateProfilePhoto).not.toHaveBeenCalled();
  });
});

describe('UserService.getProfile', () => {
  const buildUser = (overrides: Partial<User> = {}): User => ({
    id: 1,
    name: 'Nombre',
    email: 'usuario@mail.com',
    passwordHash: 'hash',
    profilePhoto: null,
    profilePhotoPath: null,
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
      {} as unknown as SupabaseStorageService,
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
