import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { HealthController } from './health.controller';
import { HealthPrismaRepository } from './health.prisma.repository';
import { HealthService } from './health.service';

@Module({
  imports: [PrismaModule],
  controllers: [HealthController],
  providers: [
    HealthService,
    {
      provide: 'healthRepository',
      useClass: HealthPrismaRepository,
    },
  ],
})
export class HealthModule {}
