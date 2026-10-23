import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';
import { APP_INTERCEPTOR } from '@nestjs/core';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { EventModule } from './event/event.module';
import { ExpenseAccountModule } from './expense-account/expense-account.module';
import { GroupModule } from './group/group.module';
import { LocationModule } from './location/location.module';
import { MemberModule } from './member/member.module';
import { NotificationModule } from './notification/notification.module';
import { PointOfInterestModule } from './point-of-interest/point-of-interest.module';
import { PrismaModule } from './prisma/prisma.module';
import { RoutingModule } from './routing/routing.module';
import { SecurityMonitoringModule } from './security-monitoring/security-monitoring.module';
import { UserModule } from './user/user.module';
import { OperationalLoggingInterceptor } from './common/logging/operational-logging.interceptor';
import { OperationalAlertService } from './common/logging/operational-alert.service';
import { PersistentLogShutdownService } from './common/logging/persistent-log-shutdown.service';
import { HealthModule } from './health/health.module';
import { MailModule } from './mail/mail.module';

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
  controllers: [AppController],
  providers: [
    AppService,
    OperationalAlertService,
    PersistentLogShutdownService,
    {
      provide: APP_INTERCEPTOR,
      useClass: OperationalLoggingInterceptor,
    },
  ],
})
export class AppModule {}
