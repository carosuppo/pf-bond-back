import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { IActivityRepository } from './activity.repository.interface';

@Injectable()
export class ActivityPrismaRepository implements IActivityRepository {
  constructor(private readonly prisma: PrismaService) {}

  async record(userId: number): Promise<void> {
    // Atomic across instances; no history, cache of user IDs or updatedAt changes.
    await this.prisma.$executeRaw`
      UPDATE public."User"
      SET "lastActivityAt" = timezone('UTC', statement_timestamp())
      WHERE id = ${userId}
        AND ("lastActivityAt" IS NULL OR "lastActivityAt" <=
          timezone('UTC', statement_timestamp()) - interval '5 minutes')
    `;
  }
}
