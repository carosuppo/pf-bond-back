import { User } from '@prisma/client';
import { CreateUserDto } from '../dto/create-user.dto';
import { UserAuthResponseDto } from '../dto/user-auth-response.dto';
import { UserResponseDto } from '../dto/user-response.dto';
import { CreateUserData } from '../interface/create-user.interface';
import { SessionTokenData } from './user-session.mapper';

export class UserMapper {
  static toCreateUserData(
    createUserDto: CreateUserDto,
    passwordHash: string,
  ): CreateUserData {
    return {
      name: createUserDto.name,
      email: createUserDto.email,
      passwordHash,
    };
  }

  static toResponseDto(user: User): UserResponseDto {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      locationId: user.locationId,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  static toAuthResponseDto(
    user: User,
    session: SessionTokenData,
  ): UserAuthResponseDto {
    return {
      sessionToken: session.sessionToken,
      expiresAt: session.expiresAt,
      user: this.toResponseDto(user),
    };
  }
}
