import { SecurityAlertType, SecurityEventType } from '@prisma/client';

export interface SecurityEventData {
  type: SecurityEventType;
  ip: string | null;
  userId: number | null;
  identifierHash: string | null;
  method: string;
  path: string;
  statusCode: number;
  createdAt: Date;
}

export interface SecurityAlertReservationData {
  type: SecurityAlertType;
  correlationKey: string;
  eventCount: number;
  windowSeconds: number;
  createdAt: Date;
  cooldownStartedAt: Date;
}

export interface SecurityAlertReservation {
  id: number;
}

export interface ISecurityEventRepository {
  createEvent(event: SecurityEventData): Promise<void>;
  countRecentAuthenticationFailures(
    identifierHash: string,
    since: Date,
  ): Promise<number>;
  countRecentLocationFailures(
    userId: number | null,
    ip: string | null,
    since: Date,
  ): Promise<number>;
  reserveAlert(
    alert: SecurityAlertReservationData,
  ): Promise<SecurityAlertReservation | null>;
  markAlertSent(id: number, sentAt: Date): Promise<void>;
  markAlertFailed(id: number): Promise<void>;
}
