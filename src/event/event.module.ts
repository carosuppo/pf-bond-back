import { Module } from '@nestjs/common';
import { GroupModule } from '../group/group.module';
import { MemberModule } from '../member/member.module';
import { NotificationModule } from '../notification/notification.module';
import { PrismaService } from '../prisma/prisma.service';
import { UserModule } from '../user/user.module';
import { EventController } from './event.controller';
import { EventService } from './event.service';
import { EventReminderController } from './reminder/event-reminder.controller';
import { EventReminderScheduler } from './reminder/event-reminder.scheduler';
import { EventReminderService } from './reminder/event-reminder.service';
import { EventReminderPrismaRepository } from './reminder/repository/event-reminder.prisma.repository';
import { EventPrismaRepository } from './repository/event.prisma.repository';
import { EventValidator } from './validator/event.validator';

@Module({
  imports: [MemberModule, GroupModule, UserModule, NotificationModule],
  controllers: [EventController, EventReminderController],
  providers: [
    EventService,
    EventReminderService,
    EventReminderScheduler,
    PrismaService,
    {
      provide: 'eventValidator',
      useClass: EventValidator,
    },
    {
      provide: 'eventRepository',
      useClass: EventPrismaRepository,
    },
    {
      provide: 'eventReminderRepository',
      useClass: EventReminderPrismaRepository,
    },
  ],
})
export class EventModule {}
