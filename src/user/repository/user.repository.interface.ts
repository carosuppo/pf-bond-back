import { User } from '@prisma/client';
import { CreateUserData } from '../interface/create-user.interface';
import { UpdateUserData } from '../interface/update-user.interface';

export interface IUserRepository {
  create(createUserData: CreateUserData): Promise<User>;

  findAll(): Promise<User[]>;

  findByEmail(email: string): Promise<User | null>;

  markEmailAsVerified(userId: number): Promise<User>;

  update(userId: number, updateUserData: UpdateUserData): Promise<User>;
}
