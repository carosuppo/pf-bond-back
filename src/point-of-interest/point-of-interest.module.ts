import { Module } from '@nestjs/common';

import { MemberModule } from '../member/member.module';
import { GroupModule } from '../group/group.module';
import { PointOfInterestController } from './point-of-interest.controller';
import { PointOfInterestService } from './point-of-interest.service';
import { PointOfInterestPrismaRepository } from './repository/point-of-interest.prisma.repository';
import { UserModule } from '../user/user.module';

@Module({
  imports: [GroupModule, MemberModule, UserModule],
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
