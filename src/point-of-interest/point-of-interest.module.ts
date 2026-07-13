import { Module } from '@nestjs/common';
import { NotificationModule } from '../notification/notification.module';
import { PrismaService } from '../prisma/prisma.service';
import { PointOfInterestController } from './point-of-interest.controller';
import { PointOfInterestService } from './point-of-interest.service';
import { PointOfInterestPrismaRepository } from './repository/point-of-interest.prisma.repository';

@Module({
  imports: [NotificationModule],
  controllers: [PointOfInterestController],
  providers: [
    PointOfInterestService,
    PrismaService,
    {
      provide: 'pointOfInterestRepository',
      useClass: PointOfInterestPrismaRepository,
    },
  ],
})
export class PointOfInterestModule {}
