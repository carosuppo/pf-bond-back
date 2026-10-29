import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { User } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { MailService } from '../mail/mail.service';
import { MINIMUM_AGE_RESTRICTION_MESSAGE } from './constants/minimum-account-age';
import {
  TERMS_ACCEPTANCE_REQUIRED_MESSAGE,
  TERMS_OF_USE_VERSION,
} from './constants/terms-of-use.constants';
import { CreateUserDto } from './dto/create-user.dto';
import { MAX_PROFILE_PHOTO_SIZE } from './constants/profile-photo.constants';
import { UpdateUserDto } from './dto/update-user.dto';
import { ProfilePhotoFile } from './interface/profile-photo-file.interface';
import type {
  EmailVerificationTokenWithUser,
  IEmailVerificationTokenRepository,
} from './repository/email-verification-token.repository.interface';
import type { IUserSessionRepository } from './repository/user-session.repository.interface';
import type { IUserRepository } from './repository/user.repository.interface';
import { AccountDeletionService } from './service/account-deletion.service';
import { SupabaseStorageService } from './storage/supabase-storage.service';
import { UserService } from './user.service';

describe('UserService email verification', () => {
  const verifiedUser: User = {
    id: 4,
    name: 'Persona',
    email: 'persona@bond.test',
    passwordHash: 'hash',
    profilePhoto: null,
    profilePhotoPath: null,
    notificationsEnabled: true,
    locationId: null,
    emailVerifiedAt: null,
    ageVerifiedAt: new Date('2026-01-01T00:00:00.000Z'),
    termsAcceptedAt: new Date('2026-01-01T00:00:00.000Z'),
    termsAcceptedVersion: TERMS_OF_USE_VERSION,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  };
  const verificationToken: EmailVerificationTokenWithUser = {
    id: 8,
    userId: verifiedUser.id,
    tokenHash: 'hash',
    expiresAt: new Date(Date.now() + 60_000),
    usedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    user: verifiedUser,
  };

  const createService = (
    userRepository: Partial<IUserRepository>,
    userSessionRepository: Partial<IUserSessionRepository>,
    emailVerificationTokenRepository: Partial<IEmailVerificationTokenRepository>,
  ): UserService =>
    new UserService(
      userRepository as unknown as IUserRepository,
      userSessionRepository as unknown as IUserSessionRepository,
      emailVerificationTokenRepository as unknown as IEmailVerificationTokenRepository,
      {} as unknown as MailService,
      {} as unknown as ConfigService,
      {} as unknown as SupabaseStorageService,
      {} as unknown as AccountDeletionService,
    );

  it('verifies the email without consuming the token before the app exchanges it', async () => {
    const emailVerificationTokenRepository: Partial<IEmailVerificationTokenRepository> =
      {
        findByTokenHash: jest.fn().mockResolvedValue(verificationToken),
        markAsUsed: jest.fn(),
      };
    const userRepository: Partial<IUserRepository> = {
      markEmailAsVerified: jest.fn().mockResolvedValue(undefined),
    };
    const service = createService(
      userRepository,
      {},
      emailVerificationTokenRepository,
    );

    await expect(
      service.verifyEmail({ token: 'verification-token' }),
    ).resolves.toEqual({
      message: 'Correo electrónico verificado correctamente.',
    });

    expect(userRepository.markEmailAsVerified).toHaveBeenCalledWith(
      verifiedUser.id,
    );
    expect(emailVerificationTokenRepository.markAsUsed).not.toHaveBeenCalled();
  });

  it('consumes the verification token once and creates a session for the app', async () => {
    const emailVerificationTokenRepository: Partial<IEmailVerificationTokenRepository> =
      {
        findByTokenHash: jest.fn().mockResolvedValue(verificationToken),
        markAsUsed: jest.fn().mockResolvedValue(true),
      };
    const userRepository: Partial<IUserRepository> = {
      markEmailAsVerified: jest.fn().mockResolvedValue(undefined),
    };
    const createdSessions: Array<{
      userId: number;
      tokenHash: string;
      expiresAt: Date;
    }> = [];
    const userSessionRepository: Partial<IUserSessionRepository> = {
      create: (session) => {
        createdSessions.push(session);
        return Promise.resolve({
          id: 1,
          ...session,
          revokedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      },
    };
    const service = createService(
      userRepository,
      userSessionRepository,
      emailVerificationTokenRepository,
    );

    const result = await service.completeEmailVerification({
      token: 'verification-token',
    });

    expect(emailVerificationTokenRepository.markAsUsed).toHaveBeenCalledWith(
      verificationToken.id,
    );
    expect(createdSessions).toHaveLength(1);
    expect(createdSessions[0].userId).toBe(verifiedUser.id);
    expect(createdSessions[0].tokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(createdSessions[0].expiresAt).toBeInstanceOf(Date);
    expect(result.sessionToken).toEqual(expect.any(String));
    expect(result.user.email).toBe(verifiedUser.email);
  });

  it('rejects exchanging a verification token that was already consumed', async () => {
    const emailVerificationTokenRepository: Partial<IEmailVerificationTokenRepository> =
      {
        findByTokenHash: jest.fn().mockResolvedValue(verificationToken),
        markAsUsed: jest.fn().mockResolvedValue(false),
      };
    const userRepository: Partial<IUserRepository> = {
      markEmailAsVerified: jest.fn().mockResolvedValue(undefined),
    };
    const userSessionRepository: Partial<IUserSessionRepository> = {
      create: jest.fn(),
    };
    const service = createService(
      userRepository,
      userSessionRepository,
      emailVerificationTokenRepository,
    );

    await expect(
      service.completeEmailVerification({ token: 'verification-token' }),
    ).rejects.toThrow(BadRequestException);
    expect(userSessionRepository.create).not.toHaveBeenCalled();
  });
});

describe('UserService minimum account age', () => {
  const birthDateForAge = (age: number): string => {
    const today = new Date();
    return new Date(
      Date.UTC(
        today.getUTCFullYear() - age,
        today.getUTCMonth(),
        today.getUTCDate(),
      ),
    )
      .toISOString()
      .slice(0, 10);
  };

  const buildUser = (
    ageVerifiedAt: Date | null,
    termsAcceptedVersion: string | null = TERMS_OF_USE_VERSION,
  ): User => ({
    id: 1,
    name: 'Persona',
    email: 'persona@bond.test',
    passwordHash: 'hash',
    profilePhoto: null,
    profilePhotoPath: null,
    notificationsEnabled: true,
    locationId: null,
    emailVerifiedAt: new Date(),
    ageVerifiedAt,
    termsAcceptedAt: termsAcceptedVersion ? new Date() : null,
    termsAcceptedVersion,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  const createService = (
    userRepository: Partial<IUserRepository>,
    userSessionRepository: Partial<IUserSessionRepository> = {},
    accountDeletionService: Partial<AccountDeletionService> = {},
  ): UserService =>
    new UserService(
      userRepository as unknown as IUserRepository,
      userSessionRepository as unknown as IUserSessionRepository,
      {} as unknown as IEmailVerificationTokenRepository,
      {} as unknown as MailService,
      {} as unknown as ConfigService,
      {} as unknown as SupabaseStorageService,
      accountDeletionService as unknown as AccountDeletionService,
    );

  it('rejects registration below 13 without creating the account', async () => {
    const userRepository: Partial<IUserRepository> = {
      create: jest.fn(),
    };
    const service = createService(userRepository);
    const user: CreateUserDto = {
      name: 'Persona',
      email: 'persona@bond.test',
      birthDate: birthDateForAge(12),
      password: 'password123',
      termsVersion: TERMS_OF_USE_VERSION,
    };

    await expect(service.create(user)).rejects.toThrow(
      MINIMUM_AGE_RESTRICTION_MESSAGE,
    );
    expect(userRepository.create).not.toHaveBeenCalled();
  });

  it('rejects registration without accepting the current terms', async () => {
    const userRepository: Partial<IUserRepository> = {
      create: jest.fn(),
    };
    const service = createService(userRepository);

    await expect(
      service.create({
        name: 'Persona',
        email: 'persona@bond.test',
        birthDate: birthDateForAge(13),
        password: 'password123',
        termsVersion: 'older-version',
      }),
    ).rejects.toThrow(TERMS_ACCEPTANCE_REQUIRED_MESSAGE);
    expect(userRepository.create).not.toHaveBeenCalled();
  });

  it('asks existing accounts to verify age before establishing a session', async () => {
    const user = buildUser(null);
    const userRepository: Partial<IUserRepository> = {
      findByEmail: jest.fn().mockResolvedValue(user),
      markAgeVerified: jest.fn(),
    };
    const userSessionRepository: Partial<IUserSessionRepository> = {
      create: jest.fn(),
    };
    const service = createService(userRepository, userSessionRepository);
    const passwordHash = await bcrypt.hash('password123', 4);
    user.passwordHash = passwordHash;

    await expect(
      service.login({ email: user.email, password: 'password123' }),
    ).rejects.toThrow(ForbiddenException);
    expect(userRepository.markAgeVerified).not.toHaveBeenCalled();
    expect(userSessionRepository.create).not.toHaveBeenCalled();
  });

  it('deletes a legacy account that fails the minimum age check', async () => {
    const user = buildUser(null);
    const userRepository: Partial<IUserRepository> = {
      findByEmail: jest.fn().mockResolvedValue(user),
      markAgeVerified: jest.fn(),
    };
    const userSessionRepository: Partial<IUserSessionRepository> = {
      create: jest.fn(),
    };
    const accountDeletionService: Partial<AccountDeletionService> = {
      deleteAccount: jest.fn().mockResolvedValue(undefined),
    };
    const service = createService(
      userRepository,
      userSessionRepository,
      accountDeletionService,
    );
    user.passwordHash = await bcrypt.hash('password123', 4);

    await expect(
      service.login({
        email: user.email,
        password: 'password123',
        birthDate: birthDateForAge(12),
      }),
    ).rejects.toThrow(MINIMUM_AGE_RESTRICTION_MESSAGE);
    expect(accountDeletionService.deleteAccount).toHaveBeenCalledWith(user.id);
    expect(userSessionRepository.create).not.toHaveBeenCalled();
  });

  it('marks an eligible legacy account verified without persisting its birth date', async () => {
    const user = buildUser(null);
    const markAgeVerified = jest.fn().mockResolvedValue({
      ...user,
      ageVerifiedAt: new Date(),
    });
    const userRepository: Partial<IUserRepository> = {
      findByEmail: jest.fn().mockResolvedValue(user),
      markAgeVerified,
    };
    const userSessionRepository: Partial<IUserSessionRepository> = {
      create: jest.fn().mockResolvedValue({}),
    };
    const service = createService(userRepository, userSessionRepository);
    user.passwordHash = await bcrypt.hash('password123', 4);

    await service.login({
      email: user.email,
      password: 'password123',
      birthDate: birthDateForAge(13),
    });

    expect(userRepository.markAgeVerified).toHaveBeenCalledWith(
      user.id,
      expect.any(Date),
    );
    expect(userSessionRepository.create).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(markAgeVerified.mock.calls)).not.toContain(
      birthDateForAge(13),
    );
  });

  it('requires existing accounts to accept the current terms before login', async () => {
    const user = buildUser(new Date(), null);
    const markTermsAccepted = jest.fn().mockResolvedValue({
      ...user,
      termsAcceptedAt: new Date(),
      termsAcceptedVersion: TERMS_OF_USE_VERSION,
    });
    const userRepository: Partial<IUserRepository> = {
      findByEmail: jest.fn().mockResolvedValue(user),
      markTermsAccepted,
    };
    const userSessionRepository: Partial<IUserSessionRepository> = {
      create: jest.fn().mockResolvedValue({}),
    };
    const service = createService(userRepository, userSessionRepository);
    user.passwordHash = await bcrypt.hash('password123', 4);

    await expect(
      service.login({ email: user.email, password: 'password123' }),
    ).rejects.toThrow(TERMS_ACCEPTANCE_REQUIRED_MESSAGE);
    expect(userSessionRepository.create).not.toHaveBeenCalled();

    await service.login({
      email: user.email,
      password: 'password123',
      termsVersion: TERMS_OF_USE_VERSION,
    });

    expect(markTermsAccepted).toHaveBeenCalledWith(
      user.id,
      expect.any(Date),
      TERMS_OF_USE_VERSION,
    );
    expect(userSessionRepository.create).toHaveBeenCalledTimes(1);
  });
});

describe('UserService.update', () => {
  const buildUser = (overrides: Partial<User> = {}): User => ({
    id: 1,
    name: 'Nombre',
    email: 'usuario@mail.com',
    passwordHash: 'hash',
    profilePhoto: null,
    profilePhotoPath: null,
    notificationsEnabled: true,
    locationId: null,
    emailVerifiedAt: new Date(),
    ageVerifiedAt: new Date(),
    termsAcceptedAt: new Date(),
    termsAcceptedVersion: TERMS_OF_USE_VERSION,
    createdAt: new Date(),
    updatedAt: new Date(),
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
      {} as unknown as AccountDeletionService,
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
    notificationsEnabled: true,
    locationId: null,
    emailVerifiedAt: new Date(),
    ageVerifiedAt: new Date(),
    termsAcceptedAt: new Date(),
    termsAcceptedVersion: TERMS_OF_USE_VERSION,
    createdAt: new Date(),
    updatedAt: new Date(),
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
      {} as unknown as AccountDeletionService,
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
    ageVerifiedAt: new Date(),
    termsAcceptedAt: new Date(),
    termsAcceptedVersion: TERMS_OF_USE_VERSION,
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
      {} as unknown as AccountDeletionService,
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
    notificationsEnabled: true,
    locationId: null,
    emailVerifiedAt: new Date(),
    ageVerifiedAt: new Date(),
    termsAcceptedAt: new Date(),
    termsAcceptedVersion: TERMS_OF_USE_VERSION,
    createdAt: new Date(),
    updatedAt: new Date(),
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
      {} as unknown as AccountDeletionService,
    );

  it('devuelve nombre, correo y listado de grupos del usuario', async () => {
    const user = buildUser();
    const groups = [
      { id: 2, name: 'Amigos', image: 'amigos.png' },
      { id: 3, name: 'Familia', image: 'familia.png' },
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
