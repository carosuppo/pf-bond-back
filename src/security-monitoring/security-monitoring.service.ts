import { createHash } from 'crypto';
import { Inject, Injectable } from '@nestjs/common';
import { SecurityEventType } from '@prisma/client';
import type {
  ISecurityEventRepository,
  SecurityEventData,
} from './repository/security-event.repository.interface';
import { SecurityAlertService } from './security-alert.service';

export interface ObservedSecurityEvent {
  type: SecurityEventType;
  ip: string | null;
  userId: number | null;
  loginEmail?: string;
  method: string;
  path: string;
  statusCode: number;
}

@Injectable()
export class SecurityMonitoringService {
  constructor(
    @Inject('securityEventRepository')
    private readonly securityEventRepository: ISecurityEventRepository,
    private readonly securityAlertService: SecurityAlertService,
  ) {}

  async record(observedEvent: ObservedSecurityEvent): Promise<void> {
    const event: SecurityEventData = {
      type: observedEvent.type,
      ip: observedEvent.ip?.slice(0, 45) ?? null,
      userId: observedEvent.userId,
      identifierHash: this.hashLoginEmail(observedEvent.loginEmail),
      method: observedEvent.method.slice(0, 10),
      path: observedEvent.path.slice(0, 500),
      statusCode: observedEvent.statusCode,
      createdAt: new Date(),
    };

    await this.securityEventRepository.createEvent(event);
    await this.securityAlertService.evaluate(event);
  }

  private hashLoginEmail(email: string | undefined): string | null {
    if (!email) return null;

    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) return null;

    return createHash('sha256').update(normalizedEmail).digest('hex');
  }
}
