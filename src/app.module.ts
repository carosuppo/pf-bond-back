import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { GroupModule } from './group/group.module';
import { LocationModule } from './location/location.module';
import { MemberModule } from './member/member.module';
import { NotificationModule } from './notification/notification.module';
import { PointOfInterestModule } from './point-of-interest/point-of-interest.module';
import { PrismaModule } from './prisma/prisma.module';
import { UserModule } from './user/user.module';

@Module({
  imports: [
    GroupModule,
    MemberModule,
    LocationModule,
    PointOfInterestModule,
    NotificationModule,
    EventEmitterModule.forRoot(),
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    PrismaModule,
    UserModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
