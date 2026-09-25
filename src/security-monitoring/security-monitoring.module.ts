import {
  MiddlewareConsumer,
  Module,
  NestModule,
  RequestMethod,
} from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MailModule } from '../mail/mail.module';
import { PrismaModule } from '../prisma/prisma.module';
import { SecurityEventPrismaRepository } from './repository/security-event.prisma.repository';
import { SecurityAlertService } from './security-alert.service';
import { SecurityMonitoringConfig } from './security-monitoring.config';
import { SecurityMonitoringMiddleware } from './security-monitoring.middleware';
import { SecurityMonitoringService } from './security-monitoring.service';

@Module({
  imports: [ConfigModule, MailModule, PrismaModule],
  providers: [
    SecurityMonitoringConfig,
    SecurityAlertService,
    SecurityMonitoringService,
    SecurityMonitoringMiddleware,
    {
      provide: 'securityEventRepository',
      useClass: SecurityEventPrismaRepository,
    },
  ],
})
export class SecurityMonitoringModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(SecurityMonitoringMiddleware).forRoutes({
      path: '{*path}',
      method: RequestMethod.ALL,
    });
  }
}
