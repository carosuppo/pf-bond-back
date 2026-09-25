import { Module } from '@nestjs/common';

import { PointOfInterestModule } from '../point-of-interest/point-of-interest.module';
import { UserModule } from '../user/user.module';
import { OpenRouteServiceProvider } from './open-route-service.provider';
import { RoutingController } from './routing.controller';
import { RoutingService } from './routing.service';

@Module({
  imports: [PointOfInterestModule, UserModule],
  controllers: [RoutingController],
  providers: [
    RoutingService,
    {
      provide: 'routingProvider',
      useClass: OpenRouteServiceProvider,
    },
  ],
})
export class RoutingModule {}
