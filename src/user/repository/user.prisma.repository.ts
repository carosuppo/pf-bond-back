import { Injectable } from '@nestjs/common';
import { User } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { UserProfileGroupEntity } from '../entity/user-profile.entity';
import { CreateUserData } from '../interface/create-user.interface';
import { UpdateUserData } from '../interface/update-user.interface';
import type { IUserRepository } from './user.repository.interface';

@Injectable()
export class UserPrismaRepository implements IUserRepository {
  constructor(private readonly prismaService: PrismaService) {}

  async create(createUserData: CreateUserData): Promise<User> {
    return this.prismaService.user.create({
      data: {
        name: createUserData.name,
        email: createUserData.email,
        passwordHash: createUserData.passwordHash,
      },
    });
  }

  async findAll(): Promise<User[]> {
    return this.prismaService.user.findMany({
      where: {
        deletedAt: null,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.prismaService.user.findFirst({
      where: {
        email,
        deletedAt: null,
      },
    });
  }

  async markEmailAsVerified(userId: number): Promise<User> {
    return this.prismaService.user.update({
      where: {
        id: userId,
      },
      data: {
        emailVerifiedAt: new Date(),
      },
    });
  }

  async findById(userId: number): Promise<User | null> {
    return this.prismaService.user.findFirst({
      where: {
        id: userId,
        deletedAt: null,
      },
    });
  }

  async findGroupsByUserId(userId: number): Promise<UserProfileGroupEntity[]> {
    const members = await this.prismaService.member.findMany({
      where: {
        userId,
        group: {
          deletedAt: null,
        },
      },
      select: {
        group: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return members
      .map((member) => ({ id: member.group.id, name: member.group.name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  async update(userId: number, updateUserData: UpdateUserData): Promise<User> {
    return this.prismaService.user.update({
      where: {
        id: userId,
      },
      data: updateUserData,
    });
  }
}
