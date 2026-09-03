import { Module } from '@nestjs/common';

import { PrismaModule } from '../prisma/prisma.module';
import { UserModule } from '../user/user.module';
import { PointOfInterestCreatedListener } from './events/point-of-interest-created.listener';
import { FirebasePushService } from './firebase/firebase-push.service';
import { NotificationController } from './notification.controller';
import { NotificationService } from './notification.service';
import { PrismaDevicePushTokenRepository } from './repository/prisma-device-push-token.repository';

@Module({
  imports: [PrismaModule, UserModule],
  controllers: [NotificationController],
  providers: [
    FirebasePushService,
    NotificationService,
    PointOfInterestCreatedListener,
    {
      provide: 'devicePushTokenRepository',
      useClass: PrismaDevicePushTokenRepository,
    },
  ],
  exports: [NotificationService],
})
export class NotificationModule {}
