import { NotificationPreferencesService } from './notification-preferences.service';
import { PrismaNotificationPreferencesRepository } from './repository/prisma-notification-preferences.repository';
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
    NotificationPreferencesService,
    {
      provide: 'notificationPreferencesRepository',
      useClass: PrismaNotificationPreferencesRepository,
    },
    PointOfInterestCreatedListener,
    {
      provide: 'devicePushTokenRepository',
      useClass: PrismaDevicePushTokenRepository,
    },
  ],
  exports: [NotificationService],
})
export class NotificationModule {}
