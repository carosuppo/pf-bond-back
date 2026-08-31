import { Module } from '@nestjs/common';

import { MemberModule } from '../member/member.module';
import { PointOfInterestController } from './point-of-interest.controller';
import { PointOfInterestService } from './point-of-interest.service';
import { PointOfInterestPrismaRepository } from './repository/point-of-interest.prisma.repository';

@Module({
  imports: [MemberModule],
  controllers: [PointOfInterestController],
  providers: [
    PointOfInterestService,
    {
      provide: 'pointOfInterestRepository',
      useClass: PointOfInterestPrismaRepository,
    },
  ],
})
export class PointOfInterestModule {}
