import { Module } from '@nestjs/common';
import { NotificationPreferencesService } from './notification-preferences.service';
import { PrismaNotificationPreferencesRepository } from './repository/prisma-notification-preferences.repository';

import { PrismaModule } from '../prisma/prisma.module';
import { UserModule } from '../user/user.module';
import { EventCancelledListener } from './events/event-cancelled.listener';
import { EventCreatedListener } from './events/event-created.listener';
import { EventUpdatedListener } from './events/event-updated.listener';
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
    EventCreatedListener,
    EventUpdatedListener,
    EventCancelledListener,
    {
      provide: 'devicePushTokenRepository',
      useClass: PrismaDevicePushTokenRepository,
    },
  ],
  exports: [NotificationService],
})
export class NotificationModule {}
