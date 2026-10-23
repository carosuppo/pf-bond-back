import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';
import { ActivityController } from './metrics/activity.controller';
import { ActivityPrismaRepository } from './metrics/activity.prisma.repository';
import { ActivityService } from './metrics/activity.service';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { OperationalAlertService } from './common/logging/operational-alert.service';
import { OperationalLoggingInterceptor } from './common/logging/operational-logging.interceptor';
import { PersistentLogShutdownService } from './common/logging/persistent-log-shutdown.service';
import { EventModule } from './event/event.module';
import { ExpenseAccountModule } from './expense-account/expense-account.module';
import { GroupModule } from './group/group.module';
import { HealthModule } from './health/health.module';
import { LocationModule } from './location/location.module';
import { MailModule } from './mail/mail.module';
import { MemberModule } from './member/member.module';
import { NotificationModule } from './notification/notification.module';
import { PointOfInterestModule } from './point-of-interest/point-of-interest.module';
import { PrismaModule } from './prisma/prisma.module';
import { RoutingModule } from './routing/routing.module';
import { SecurityMonitoringModule } from './security-monitoring/security-monitoring.module';
import { UserModule } from './user/user.module';

@Module({
  imports: [
    GroupModule,
    MemberModule,
    LocationModule,
    PointOfInterestModule,
    NotificationModule,
    EventEmitterModule.forRoot(),
    ScheduleModule.forRoot(),
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    PrismaModule,
    SecurityMonitoringModule,
    UserModule,
    EventModule,
    ExpenseAccountModule,
    RoutingModule,
    HealthModule,
    MailModule,
  ],
  controllers: [AppController, ActivityController],
  providers: [
    AppService,
    { provide: 'activityRepository', useClass: ActivityPrismaRepository },
    ActivityService,
    OperationalAlertService,
    PersistentLogShutdownService,
    {
      provide: APP_INTERCEPTOR,
      useClass: OperationalLoggingInterceptor,
    },
  ],
})
export class AppModule {}
