import { PointOfInterestPresenceService } from '../point-of-interest/presence/point-of-interest-presence.service';
import { PointOfInterestPresencePrismaRepository } from '../point-of-interest/presence/point-of-interest-presence.prisma.repository';
import { Module } from '@nestjs/common';
import { GroupModule } from '../group/group.module';
import { UserModule } from '../user/user.module';
import { LocationController } from './location.controller';
import { LocationGateway } from './location.gateway';
import { LocationService } from './location.service';
import { LocationPrismaRepository } from './repository/location.prisma.repository';

@Module({
  imports: [UserModule, GroupModule],
  controllers: [LocationController],
  providers: [
    LocationService,
    PointOfInterestPresenceService,
    {
      provide: 'pointOfInterestPresenceRepository',
      useClass: PointOfInterestPresencePrismaRepository,
    },
    LocationGateway,
    { provide: 'locationRepository', useClass: LocationPrismaRepository },
  ],
})
export class LocationModule {}
