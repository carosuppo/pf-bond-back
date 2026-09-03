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
    LocationGateway,
    { provide: 'locationRepository', useClass: LocationPrismaRepository },
  ],
})
export class LocationModule {}
