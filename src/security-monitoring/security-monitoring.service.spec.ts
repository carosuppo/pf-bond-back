import { ConfigService } from '@nestjs/config';
import {
  SecurityAlertStatus,
  SecurityAlertType,
  SecurityEventType,
} from '@prisma/client';
import { MailService } from '../mail/mail.service';
import type {
  ISecurityEventRepository,
  SecurityAlertReservation,
  SecurityAlertReservationData,
  SecurityEventData,
} from './repository/security-event.repository.interface';
import { SecurityAlertService } from './security-alert.service';
import { SecurityMonitoringConfig } from './security-monitoring.config';
import { SecurityMonitoringService } from './security-monitoring.service';

interface StoredAlert extends SecurityAlertReservationData {
  id: number;
  status: SecurityAlertStatus;
  sentAt: Date | null;
}

class InMemorySecurityEventRepository implements ISecurityEventRepository {
  readonly events: SecurityEventData[] = [];
  readonly alerts: StoredAlert[] = [];

  createEvent(event: SecurityEventData): Promise<void> {
    this.events.push(event);
    return Promise.resolve();
  }

  countRecentAuthenticationFailures(
    identifierHash: string,
    since: Date,
  ): Promise<number> {
    return Promise.resolve(
      this.events.filter(
        (event) =>
          event.type === SecurityEventType.AUTH_LOGIN_FAILED &&
          event.identifierHash === identifierHash &&
          event.createdAt >= since,
      ).length,
    );
  }

  countRecentLocationFailures(
    userId: number | null,
    ip: string | null,
    since: Date,
  ): Promise<number> {
    return Promise.resolve(
      this.events.filter(
        (event) =>
          event.type !== SecurityEventType.AUTH_LOGIN_FAILED &&
          event.createdAt >= since &&
          (userId !== null
            ? event.userId === userId
            : event.userId === null && event.ip === ip),
      ).length,
    );
  }

  reserveAlert(
    alert: SecurityAlertReservationData,
  ): Promise<SecurityAlertReservation | null> {
    const duplicate = this.alerts.some(
      (storedAlert) =>
        storedAlert.type === alert.type &&
        storedAlert.correlationKey === alert.correlationKey &&
        storedAlert.status !== SecurityAlertStatus.FAILED &&
        storedAlert.createdAt >= alert.cooldownStartedAt,
    );

    if (duplicate) return Promise.resolve(null);

    const storedAlert: StoredAlert = {
      ...alert,
      id: this.alerts.length + 1,
      status: SecurityAlertStatus.PENDING,
      sentAt: null,
    };
    this.alerts.push(storedAlert);
    return Promise.resolve({ id: storedAlert.id });
  }

  markAlertSent(id: number, sentAt: Date): Promise<void> {
    const alert = this.alerts.find((candidate) => candidate.id === id);
    if (!alert) throw new Error('Alert not found');
    alert.status = SecurityAlertStatus.SENT;
    alert.sentAt = sentAt;
    return Promise.resolve();
  }

  markAlertFailed(id: number): Promise<void> {
    const alert = this.alerts.find((candidate) => candidate.id === id);
    if (!alert) throw new Error('Alert not found');
    alert.status = SecurityAlertStatus.FAILED;
    return Promise.resolve();
  }
}

describe('SecurityMonitoringService', () => {
  let repository: InMemorySecurityEventRepository;
  let monitoringService: SecurityMonitoringService;
  let sendSecurityAlert: jest.Mock;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-09-23T12:00:00.000Z'));
    repository = new InMemorySecurityEventRepository();
    sendSecurityAlert = jest.fn().mockResolvedValue(undefined);

    const values: Record<string, string> = {
      SECURITY_AUTH_THRESHOLD: '5',
      SECURITY_AUTH_WINDOW_SECONDS: '600',
      SECURITY_LOCATION_THRESHOLD: '10',
      SECURITY_LOCATION_WINDOW_SECONDS: '300',
      SECURITY_ALERT_COOLDOWN_SECONDS: '900',
      SECURITY_ALERT_EMAIL: 'giudicitomas1@gmail.com',
    };
    const configService = {
      get: jest.fn((key: string) => values[key]),
    } as unknown as ConfigService;
    const config = new SecurityMonitoringConfig(configService);
    const alertService = new SecurityAlertService(repository, config, {
      sendSecurityAlert,
    } as unknown as MailService);
    monitoringService = new SecurityMonitoringService(repository, alertService);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('registra un login incorrecto con hash del email y no alerta', async () => {
    await recordFailedLogin(monitoringService);

    expect(repository.events).toHaveLength(1);
    expect(repository.events[0].identifierHash).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.stringify(repository.events[0])).not.toContain(
      'target@example.com',
    );
    expect(sendSecurityAlert).not.toHaveBeenCalled();
  });

  it('no alerta con cuatro intentos fallidos dentro de diez minutos', async () => {
    await repeat(4, () => recordFailedLogin(monitoringService));

    expect(repository.events).toHaveLength(4);
    expect(sendSecurityAlert).not.toHaveBeenCalled();
  });

  it('alerta al quinto intento fallido contra la misma cuenta', async () => {
    await repeat(5, () => recordFailedLogin(monitoringService));

    expect(sendSecurityAlert).toHaveBeenCalledTimes(1);
    expect(sendSecurityAlert).toHaveBeenCalledWith(
      'giudicitomas1@gmail.com',
      expect.objectContaining({
        type: SecurityAlertType.AUTH_LOGIN_FAILED,
        eventCount: 5,
        windowSeconds: 600,
      }),
    );
  });

  it('no suma intentos que quedaron fuera de la ventana temporal', async () => {
    await repeat(4, () => recordFailedLogin(monitoringService));
    jest.advanceTimersByTime(601_000);
    await recordFailedLogin(monitoringService);

    expect(repository.events).toHaveLength(5);
    expect(sendSecurityAlert).not.toHaveBeenCalled();
  });

  it('aplica cooldown después de una alerta de autenticación', async () => {
    await repeat(5, () => recordFailedLogin(monitoringService));
    await recordFailedLogin(monitoringService);

    expect(repository.events).toHaveLength(6);
    expect(repository.alerts).toHaveLength(1);
    expect(sendSecurityAlert).toHaveBeenCalledTimes(1);
  });

  it('alerta al décimo rechazo sospechoso de ubicación del mismo usuario', async () => {
    await repeat(9, () => recordForbiddenLocation(monitoringService));
    expect(sendSecurityAlert).not.toHaveBeenCalled();

    await recordForbiddenLocation(monitoringService);

    expect(sendSecurityAlert).toHaveBeenCalledTimes(1);
    expect(sendSecurityAlert).toHaveBeenCalledWith(
      'giudicitomas1@gmail.com',
      expect.objectContaining({
        type: SecurityAlertType.LOCATION_ACCESS_DENIED,
        eventCount: 10,
        userId: 7,
        windowSeconds: 300,
      }),
    );
  });

  it('correlaciona los 401 anónimos de ubicación por IP', async () => {
    await repeat(10, () =>
      monitoringService.record({
        type: SecurityEventType.LOCATION_UNAUTHORIZED,
        ip: '203.0.113.20',
        userId: null,
        method: 'GET',
        path: '/location/sharing',
        statusCode: 401,
      }),
    );

    expect(sendSecurityAlert).toHaveBeenCalledWith(
      'giudicitomas1@gmail.com',
      expect.objectContaining({
        eventCount: 10,
        ip: '203.0.113.20',
        userId: null,
      }),
    );
  });

  it('no mezcla rechazos de ubicación de usuarios diferentes', async () => {
    await repeat(5, () => recordForbiddenLocation(monitoringService));
    await repeat(5, () =>
      monitoringService.record({
        type: SecurityEventType.LOCATION_FORBIDDEN,
        ip: '203.0.113.10',
        userId: 8,
        method: 'GET',
        path: '/location/group/99/members',
        statusCode: 403,
      }),
    );

    expect(repository.events).toHaveLength(10);
    expect(sendSecurityAlert).not.toHaveBeenCalled();
  });

  it('permite una nueva alerta cuando terminó el cooldown', async () => {
    await repeat(5, () => recordFailedLogin(monitoringService));
    jest.advanceTimersByTime(901_000);
    await repeat(5, () => recordFailedLogin(monitoringService));

    expect(sendSecurityAlert).toHaveBeenCalledTimes(2);
  });
});

async function recordFailedLogin(
  service: SecurityMonitoringService,
): Promise<void> {
  await service.record({
    type: SecurityEventType.AUTH_LOGIN_FAILED,
    ip: '203.0.113.10',
    userId: null,
    loginEmail: ' Target@Example.com ',
    method: 'POST',
    path: '/user/login',
    statusCode: 401,
  });
}

async function recordForbiddenLocation(
  service: SecurityMonitoringService,
): Promise<void> {
  await service.record({
    type: SecurityEventType.LOCATION_FORBIDDEN,
    ip: '203.0.113.10',
    userId: 7,
    method: 'GET',
    path: '/location/group/99/members',
    statusCode: 403,
  });
}

async function repeat(
  times: number,
  action: () => Promise<void>,
): Promise<void> {
  for (let index = 0; index < times; index += 1) {
    await action();
  }
}
