import { Module } from '@nestjs/common';
import { UserModule } from '../user/user.module';
import { LocationController } from './location.controller';
import { LocationEventService } from './location-event.service';
import { LocationGateway } from './location.gateway';
import { LocationService } from './location.service';
import { LocationPrismaRepository } from './repository/location.prisma.repository';

@Module({
  imports: [UserModule],
  controllers: [LocationController],
  providers: [
    LocationService,
    LocationEventService,
    LocationGateway,
    { provide: 'locationRepository', useClass: LocationPrismaRepository },
  ],
})
export class LocationModule {}
