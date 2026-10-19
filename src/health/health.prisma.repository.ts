import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { IHealthRepository } from './health.repository.interface';

@Injectable()
export class HealthPrismaRepository implements IHealthRepository {
  constructor(private readonly prisma: PrismaService) {}

  async checkDatabaseConnection(): Promise<void> {
    await this.prisma.$queryRaw`SELECT 1`;
  }
}
