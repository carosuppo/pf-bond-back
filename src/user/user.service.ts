import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes } from 'crypto';
import { CreateUserDto } from './dto/create-user.dto';
import { LoginUserDto } from './dto/login-user.dto';
import { UserAuthResponseDto } from './dto/user-auth-response.dto';
import { UserResponseDto } from './dto/user-response.dto';
import {
  SessionTokenData,
  UserSessionMapper,
} from './mapper/user-session.mapper';
import { UserMapper } from './mapper/user.mapper';
import type { IUserSessionRepository } from './repository/user-session.repository.interface';
import type { IUserRepository } from './repository/user.repository.interface';

@Injectable()
export class UserService {
  private readonly sessionDurationInDays = 90;

  constructor(
    @Inject('userRepository')
    private readonly userRepository: IUserRepository,

    @Inject('userSessionRepository')
    private readonly userSessionRepository: IUserSessionRepository,
  ) {}

  async create(createUserDto: CreateUserDto): Promise<UserAuthResponseDto> {
    const passwordHash: string = await bcrypt.hash(createUserDto.password, 12);

    const createUserData = UserMapper.toCreateUserData(
      createUserDto,
      passwordHash,
    );

    try {
      const user = await this.userRepository.create(createUserData);
      const session = await this.createSession(user.id);

      return UserMapper.toAuthResponseDto(user, session);
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

    const session = await this.createSession(user.id);

    return UserMapper.toAuthResponseDto(user, session);
  }

  private async createSession(userId: number): Promise<SessionTokenData> {
    const sessionToken = randomBytes(48).toString('base64url');

    const tokenHash = createHash('sha256').update(sessionToken).digest('hex');

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

  async logout(sessionId: number): Promise<void> {
    await this.userSessionRepository.revokeById(sessionId);
  }
}
