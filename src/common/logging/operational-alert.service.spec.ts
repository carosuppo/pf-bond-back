import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MailService } from '../../mail/mail.service';
import { logErrorSafely } from './error-logging';
import { OperationalAlertService } from './operational-alert.service';

describe('OperationalAlertService', () => {
  let service: OperationalAlertService;
  let sendOperationalAlert: jest.Mock;

  afterEach(() => {
    service?.onModuleDestroy();
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('emails after repeated errors and suppresses alerts during cooldown', () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-10-15T12:00:00.000Z'));
    const values = new Map<string, string>([
      ['OPERATIONS_ALERT_EMAIL', 'operations@example.com'],
      ['OPERATIONS_ALERT_THRESHOLD', '5'],
      ['OPERATIONS_ALERT_WINDOW_SECONDS', '300'],
      ['OPERATIONS_ALERT_COOLDOWN_SECONDS', '1800'],
    ]);
    const configService = {
      get: (key: string) => values.get(key),
    } as unknown as ConfigService;
    sendOperationalAlert = jest.fn().mockResolvedValue(undefined);
    const mailService = {
      sendOperationalAlert,
    } as unknown as MailService;
    service = new OperationalAlertService(configService, mailService);
    const logger = new Logger('ReminderScheduler');
    jest.spyOn(logger, 'error').mockImplementation(() => undefined);

    for (let count = 0; count < 5; count += 1) {
      logErrorSafely(
        logger,
        'operation=sendReminders outcome=error',
        new Error('token=private'),
      );
    }

    expect(sendOperationalAlert).toHaveBeenCalledTimes(1);
    expect(sendOperationalAlert).toHaveBeenCalledWith(
      'operations@example.com',
      expect.objectContaining({
        module: 'ReminderScheduler',
        operation: 'sendReminders',
        failureCount: 5,
        windowSeconds: 300,
        errorType: 'Error',
      }),
    );
    expect(JSON.stringify(sendOperationalAlert.mock.calls[0])).not.toContain(
      'private',
    );

    for (let count = 0; count < 5; count += 1) {
      logErrorSafely(
        logger,
        'operation=sendReminders outcome=error',
        new Error('failure'),
      );
    }

    expect(sendOperationalAlert).toHaveBeenCalledTimes(1);

    jest.advanceTimersByTime(30 * 60 * 1000);

    for (let count = 0; count < 5; count += 1) {
      logErrorSafely(
        logger,
        'operation=sendReminders outcome=error',
        new Error('failure'),
      );
    }

    expect(sendOperationalAlert).toHaveBeenCalledTimes(2);
  });

  it('does not send an alert without an operations recipient', () => {
    const configService = {
      get: () => undefined,
    } as unknown as ConfigService;
    sendOperationalAlert = jest.fn().mockResolvedValue(undefined);
    const mailService = {
      sendOperationalAlert,
    } as unknown as MailService;
    service = new OperationalAlertService(configService, mailService);
    const logger = new Logger('ReminderScheduler');
    jest.spyOn(logger, 'error').mockImplementation(() => undefined);

    for (let count = 0; count < 5; count += 1) {
      logErrorSafely(
        logger,
        'operation=sendReminders outcome=error',
        new Error('failure'),
      );
    }

    expect(sendOperationalAlert).not.toHaveBeenCalled();
  });
});
