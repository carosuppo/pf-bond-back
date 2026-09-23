import { Injectable } from '@nestjs/common';
import { SecurityAlertStatus, SecurityEventType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  ISecurityEventRepository,
  SecurityAlertReservation,
  SecurityAlertReservationData,
  SecurityEventData,
} from './security-event.repository.interface';

@Injectable()
export class SecurityEventPrismaRepository implements ISecurityEventRepository {
  constructor(private readonly prisma: PrismaService) {}

  async createEvent(event: SecurityEventData): Promise<void> {
    await this.prisma.securityEvent.create({ data: event });
  }

  countRecentAuthenticationFailures(
    identifierHash: string,
    since: Date,
  ): Promise<number> {
    return this.prisma.securityEvent.count({
      where: {
        type: SecurityEventType.AUTH_LOGIN_FAILED,
        identifierHash,
        createdAt: { gte: since },
      },
    });
  }

  countRecentLocationFailures(
    userId: number | null,
    ip: string | null,
    since: Date,
  ): Promise<number> {
    return this.prisma.securityEvent.count({
      where: {
        type: {
          in: [
            SecurityEventType.LOCATION_UNAUTHORIZED,
            SecurityEventType.LOCATION_FORBIDDEN,
          ],
        },
        createdAt: { gte: since },
        ...(userId !== null ? { userId } : { userId: null, ip }),
      },
    });
  }

  reserveAlert(
    alert: SecurityAlertReservationData,
  ): Promise<SecurityAlertReservation | null> {
    return this.prisma.$transaction(async (transaction) => {
      await transaction.$queryRaw`
        SELECT pg_advisory_xact_lock(hashtext(${alert.correlationKey}))
      `;

      const existingAlert = await transaction.securityAlert.findFirst({
        where: {
          type: alert.type,
          correlationKey: alert.correlationKey,
          status: {
            in: [SecurityAlertStatus.PENDING, SecurityAlertStatus.SENT],
          },
          createdAt: { gte: alert.cooldownStartedAt },
        },
        select: { id: true },
      });

      if (existingAlert) return null;

      return transaction.securityAlert.create({
        data: {
          type: alert.type,
          correlationKey: alert.correlationKey,
          eventCount: alert.eventCount,
          windowSeconds: alert.windowSeconds,
          createdAt: alert.createdAt,
        },
        select: { id: true },
      });
    });
  }

  async markAlertSent(id: number, sentAt: Date): Promise<void> {
    await this.prisma.securityAlert.update({
      where: { id },
      data: { status: SecurityAlertStatus.SENT, sentAt },
    });
  }

  async markAlertFailed(id: number): Promise<void> {
    await this.prisma.securityAlert.update({
      where: { id },
      data: { status: SecurityAlertStatus.FAILED },
    });
  }
}
