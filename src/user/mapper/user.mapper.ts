import { User } from '@prisma/client';
import { CreateUserDto } from '../dto/create-user.dto';
import { UpdateUserDto } from '../dto/update-user.dto';
import { UserAuthResponseDto } from '../dto/user-auth-response.dto';
import { UserResponseDto } from '../dto/user-response.dto';
import { CreateUserData } from '../interface/create-user.interface';
import { UpdateUserData } from '../interface/update-user.interface';
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

  static toUpdateData(updateUserDto: UpdateUserDto): UpdateUserData {
    const data: UpdateUserData = {};

    if (updateUserDto.name !== undefined) {
      data.name = updateUserDto.name;
    }

    if (updateUserDto.email !== undefined) {
      data.email = updateUserDto.email;
    }

    return data;
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
