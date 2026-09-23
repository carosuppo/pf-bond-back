import { Inject, Injectable } from '@nestjs/common';
import { SecurityAlertType, SecurityEventType } from '@prisma/client';
import { MailService } from '../mail/mail.service';
import type {
  ISecurityEventRepository,
  SecurityEventData,
} from './repository/security-event.repository.interface';
import { SecurityMonitoringConfig } from './security-monitoring.config';

@Injectable()
export class SecurityAlertService {
  constructor(
    @Inject('securityEventRepository')
    private readonly securityEventRepository: ISecurityEventRepository,
    private readonly config: SecurityMonitoringConfig,
    private readonly mailService: MailService,
  ) {}

  async evaluate(event: SecurityEventData): Promise<void> {
    if (event.type === SecurityEventType.AUTH_LOGIN_FAILED) {
      await this.evaluateAuthenticationFailures(event);
      return;
    }

    await this.evaluateLocationFailures(event);
  }

  private async evaluateAuthenticationFailures(
    event: SecurityEventData,
  ): Promise<void> {
    if (!event.identifierHash) return;

    const windowSeconds = this.config.authWindowSeconds;
    const eventCount =
      await this.securityEventRepository.countRecentAuthenticationFailures(
        event.identifierHash,
        this.secondsBefore(event.createdAt, windowSeconds),
      );

    if (eventCount < this.config.authThreshold) return;

    await this.sendAlert({
      alertType: SecurityAlertType.AUTH_LOGIN_FAILED,
      correlationKey: `${SecurityAlertType.AUTH_LOGIN_FAILED}:${event.identifierHash}`,
      event,
      eventCount,
      windowSeconds,
      reason:
        'Se superó el umbral de intentos fallidos contra la misma cuenta.',
    });
  }

  private async evaluateLocationFailures(
    event: SecurityEventData,
  ): Promise<void> {
    if (event.userId === null && event.ip === null) return;

    const windowSeconds = this.config.locationWindowSeconds;
    const eventCount =
      await this.securityEventRepository.countRecentLocationFailures(
        event.userId,
        event.ip,
        this.secondsBefore(event.createdAt, windowSeconds),
      );

    if (eventCount < this.config.locationThreshold) return;

    const actorKey =
      event.userId !== null ? `user:${event.userId}` : `ip:${event.ip}`;

    await this.sendAlert({
      alertType: SecurityAlertType.LOCATION_ACCESS_DENIED,
      correlationKey: `${SecurityAlertType.LOCATION_ACCESS_DENIED}:${actorKey}`,
      event,
      eventCount,
      windowSeconds,
      reason:
        'Se superó el umbral de accesos HTTP 401/403 sospechosos a geolocalización.',
    });
  }

  private async sendAlert(input: {
    alertType: SecurityAlertType;
    correlationKey: string;
    event: SecurityEventData;
    eventCount: number;
    windowSeconds: number;
    reason: string;
  }): Promise<void> {
    const reservation = await this.securityEventRepository.reserveAlert({
      type: input.alertType,
      correlationKey: input.correlationKey,
      eventCount: input.eventCount,
      windowSeconds: input.windowSeconds,
      createdAt: input.event.createdAt,
      cooldownStartedAt: this.secondsBefore(
        input.event.createdAt,
        this.config.alertCooldownSeconds,
      ),
    });

    if (!reservation) return;

    try {
      await this.mailService.sendSecurityAlert(this.config.alertEmail, {
        type: input.alertType,
        eventCount: input.eventCount,
        windowSeconds: input.windowSeconds,
        detectedAt: input.event.createdAt,
        ip: input.event.ip,
        userId: input.event.userId,
        path: input.event.path,
        reason: input.reason,
      });
      await this.securityEventRepository.markAlertSent(
        reservation.id,
        input.event.createdAt,
      );
    } catch (error: unknown) {
      await this.securityEventRepository.markAlertFailed(reservation.id);
      throw error;
    }
  }

  private secondsBefore(date: Date, seconds: number): Date {
    return new Date(date.getTime() - seconds * 1000);
  }
}
