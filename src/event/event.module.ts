import { Module } from '@nestjs/common';
import { GroupModule } from '../group/group.module';
import { MemberModule } from '../member/member.module';
import { PrismaService } from '../prisma/prisma.service';
import { UserModule } from '../user/user.module';
import { EventController } from './event.controller';
import { EventService } from './event.service';
import { EventPrismaRepository } from './repository/event.prisma.repository';
import { EventValidator } from './validator/event.validator';

@Module({
  imports: [MemberModule, GroupModule, UserModule],
  controllers: [EventController],
  providers: [
    EventService,
    PrismaService,
    {
      provide: 'eventValidator',
      useClass: EventValidator,
    },
    {
      provide: 'eventRepository',
      useClass: EventPrismaRepository,
    },
  ],
})
export class EventModule {}
