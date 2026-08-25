import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, User } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes } from 'crypto';
import { MailService } from '../mail/mail.service';
import { CreateUserDto } from './dto/create-user.dto';
import { LoginUserDto } from './dto/login-user.dto';
import { MessageResponseDto } from './dto/message-response.dto';
import { ResendVerificationEmailDto } from './dto/resend-verification-email.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserAuthResponseDto } from './dto/user-auth-response.dto';
import { UserResponseDto } from './dto/user-response.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import {
  SessionTokenData,
  UserSessionMapper,
} from './mapper/user-session.mapper';
import { UserMapper } from './mapper/user.mapper';
import type { IEmailVerificationTokenRepository } from './repository/email-verification-token.repository.interface';
import type { IUserSessionRepository } from './repository/user-session.repository.interface';
import type { IUserRepository } from './repository/user.repository.interface';

@Injectable()
export class UserService {
  private readonly sessionDurationInDays = 90;
  private readonly emailVerificationDurationInHours = 24;

  constructor(
    @Inject('userRepository')
    private readonly userRepository: IUserRepository,

    @Inject('userSessionRepository')
    private readonly userSessionRepository: IUserSessionRepository,

    @Inject('emailVerificationTokenRepository')
    private readonly emailVerificationTokenRepository: IEmailVerificationTokenRepository,

    private readonly mailService: MailService,
    private readonly configService: ConfigService,
  ) {}

  async create(createUserDto: CreateUserDto): Promise<MessageResponseDto> {
    try {
      const passwordHash: string = await bcrypt.hash(
        createUserDto.password,
        12,
      );

      const createUserData = UserMapper.toCreateUserData(
        createUserDto,
        passwordHash,
      );

      const createdUser = await this.userRepository.create(createUserData);

      await this.createAndSendEmailVerification(createdUser);

      return {
        message:
          'Usuario registrado correctamente. Revisá tu correo para verificar la cuenta.',
      };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('El mail ingresado ya está en uso.');
      }

      throw error;
    }
  }

  async verifyEmail(
    verifyEmailDto: VerifyEmailDto,
  ): Promise<MessageResponseDto> {
    const tokenHash = this.hashToken(verifyEmailDto.token);

    const verificationToken =
      await this.emailVerificationTokenRepository.findByTokenHash(tokenHash);

    if (
      !verificationToken ||
      verificationToken.usedAt ||
      verificationToken.expiresAt < new Date()
    ) {
      throw new BadRequestException(
        'El token de verificación es inválido o expiró.',
      );
    }

    if (verificationToken.user.deletedAt) {
      throw new BadRequestException('El usuario no existe.');
    }

    if (!verificationToken.user.emailVerifiedAt) {
      await this.userRepository.markEmailAsVerified(verificationToken.userId);
    }

    await this.emailVerificationTokenRepository.markAsUsed(
      verificationToken.id,
    );

    return {
      message: 'Correo electrónico verificado correctamente.',
    };
  }

  async resendVerificationEmail(
    resendVerificationEmailDto: ResendVerificationEmailDto,
  ): Promise<MessageResponseDto> {
    const email: string = resendVerificationEmailDto.email;

    const user = await this.userRepository.findByEmail(email);

    if (user && !user.emailVerifiedAt) {
      await this.createAndSendEmailVerification(user);
    }

    return {
      message:
        'Si el correo existe y no está verificado, se enviará un nuevo mail.',
    };
  }

  async findAll(): Promise<UserResponseDto[]> {
    const users = await this.userRepository.findAll();

    return users.map((user) => UserMapper.toResponseDto(user));
  }

  async findByEmail(email: string): Promise<UserResponseDto> {
    const user = await this.userRepository.findByEmail(email);

    if (!user) {
      throw new NotFoundException('Usuario no encontrado.');
    }

    return UserMapper.toResponseDto(user);
  }

  async getProfile(userId: number): Promise<UserResponseDto> {
    const user = await this.userRepository.findById(userId);

    if (!user) {
      throw new NotFoundException('Usuario no encontrado.');
    }

    const groups = await this.userRepository.findGroupsByUserId(userId);

    return UserMapper.toProfileResponseDto(user, groups);
  }

  async update(
    userId: number,
    updateUserDto: UpdateUserDto,
  ): Promise<UserResponseDto> {
    const updateUserData = UserMapper.toUpdateData(updateUserDto);

    if (
      updateUserData.name === undefined &&
      updateUserData.email === undefined
    ) {
      throw new BadRequestException(
        'Debes enviar al menos un campo para actualizar.',
      );
    }

    if (updateUserData.email !== undefined) {
      const existingUser = await this.userRepository.findByEmail(
        updateUserData.email,
      );

      if (existingUser && existingUser.id !== userId) {
        throw new ConflictException('El mail ingresado ya está en uso.');
      }
    }

    const updatedUser = await this.userRepository.update(
      userId,
      updateUserData,
    );

    return UserMapper.toResponseDto(updatedUser);
  }

  async login(loginUserDto: LoginUserDto): Promise<UserAuthResponseDto> {
    const user = await this.userRepository.findByEmail(loginUserDto.email);

    if (!user) {
      throw new UnauthorizedException('Mail o contraseña incorrectos.');
    }

    const isPasswordValid: boolean = await bcrypt.compare(
      loginUserDto.password,
      user.passwordHash,
    );

    if (!isPasswordValid) {
      throw new UnauthorizedException('Mail o contraseña incorrectos.');
    }

    if (!user.emailVerifiedAt) {
      throw new ForbiddenException(
        'Debes verificar tu correo electrónico antes de iniciar sesión.',
      );
    }

    const session = await this.createSession(user.id);

    return UserMapper.toAuthResponseDto(user, session);
  }

  async logout(sessionId: number): Promise<void> {
    await this.userSessionRepository.revokeById(sessionId);
  }

  private async createSession(userId: number): Promise<SessionTokenData> {
    const sessionToken = randomBytes(48).toString('base64url');

    const tokenHash = this.hashToken(sessionToken);

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + this.sessionDurationInDays);

    const createUserSessionData = UserSessionMapper.toCreateUserSessionData(
      userId,
      tokenHash,
      expiresAt,
    );

    await this.userSessionRepository.create(createUserSessionData);

    return UserSessionMapper.toSessionTokenData(sessionToken, expiresAt);
  }

  private async createAndSendEmailVerification(user: User): Promise<void> {
    await this.emailVerificationTokenRepository.invalidateActiveByUserId(
      user.id,
    );

    const token = randomBytes(48).toString('base64url');
    const tokenHash = this.hashToken(token);

    const expiresAt = new Date();
    expiresAt.setHours(
      expiresAt.getHours() + this.emailVerificationDurationInHours,
    );

    await this.emailVerificationTokenRepository.create({
      userId: user.id,
      tokenHash,
      expiresAt,
    });

    const apiBaseUrl = this.getRequiredEnv('API_BASE_URL');

    const verificationUrl = `${apiBaseUrl}/user/verify-email?token=${encodeURIComponent(
      token,
    )}`;

    await this.mailService.sendEmailVerification(
      user.email,
      user.name,
      verificationUrl,
    );
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private getRequiredEnv(key: string): string {
    const value = this.configService.get<string>(key);

    if (!value) {
      throw new Error(`La variable de entorno ${key} no está definida.`);
    }

    return value;
  }
}
