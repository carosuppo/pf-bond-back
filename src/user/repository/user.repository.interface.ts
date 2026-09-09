import { User } from '@prisma/client';
import { UserProfileGroupEntity } from '../entity/user-profile.entity';
import { CreateUserData } from '../interface/create-user.interface';
import { UpdateUserData } from '../interface/update-user.interface';

export interface IUserRepository {
  create(createUserData: CreateUserData): Promise<User>;

  findAll(): Promise<User[]>;

  findByEmail(email: string): Promise<User | null>;

  findById(userId: number): Promise<User | null>;

  markEmailAsVerified(userId: number): Promise<User>;

  findById(userId: number): Promise<User | null>;

  findGroupsByUserId(userId: number): Promise<UserProfileGroupEntity[]>;

  update(userId: number, updateUserData: UpdateUserData): Promise<User>;

  updatePassword(userId: number, passwordHash: string): Promise<User>;
}
