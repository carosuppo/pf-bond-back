import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { logErrorSafely, logSafely } from '../common/logging/error-logging';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    const url = process.env.DATABASE_URL;
    if (!url) {
      throw new Error('DATABASE_URL no está definida');
    }

    super({
      adapter: new PrismaPg(url),
    });
  }

  async onModuleInit() {
    try {
      await this.$connect();
      logSafely(this.logger, 'log', 'operation=connect outcome=connected');
    } catch (error: unknown) {
      logErrorSafely(this.logger, 'operation=connect outcome=error', error);
      throw new Error('Database connection failed');
    }
  }

  async onModuleDestroy() {
    try {
      await this.$disconnect();
      logSafely(this.logger, 'log', 'operation=disconnect outcome=completed');
    } catch (error: unknown) {
      logErrorSafely(this.logger, 'operation=disconnect outcome=error', error);
      throw new Error('Database disconnection failed');
    }
  }
}
