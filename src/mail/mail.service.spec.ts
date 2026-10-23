import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { MailService } from './mail.service';

jest.mock('nodemailer', () => ({ createTransport: jest.fn() }));

describe('MailService', () => {
  afterEach(() => jest.restoreAllMocks());

  it('logs SMTP failures without logging recipient or message content', async () => {
    const error = Object.assign(new Error('secret SMTP payload'), {
      code: 'ESMTP',
    });
    const sendMail = jest.fn().mockRejectedValue(error);
    const transporter = {
      sendMail,
    } as unknown as ReturnType<typeof nodemailer.createTransport>;
    jest.mocked(nodemailer.createTransport).mockReturnValue(transporter);
    const config = {
      get: jest.fn((key: string) => {
        const values: Record<string, string> = {
          MAIL_HOST: 'smtp.test',
          MAIL_PORT: '587',
          MAIL_USER: 'smtp-user',
          MAIL_PASSWORD: 'smtp-password',
          MAIL_FROM: 'noreply@example.com',
        };
        return values[key];
      }),
    } as unknown as ConfigService;
    const logger = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
    const service = new MailService(config);

    await expect(
      service.sendEmailVerification(
        'person@example.com',
        'Sensitive Name',
        'https://example.com/verify?token=private',
      ),
    ).rejects.toBe(error);

    expect(logger).toHaveBeenCalledWith(
      'operation=sendEmailVerification provider=SMTP outcome=error errorType=Error errorCode=ESMTP',
    );
    const logged = JSON.stringify(logger.mock.calls);
    expect(logged).not.toContain('person@example.com');
    expect(logged).not.toContain('Sensitive Name');
    expect(logged).not.toContain('private');
    expect(sendMail).toHaveBeenCalledTimes(1);
  });

  it('sends operational alerts with only module, operation and safe error details', async () => {
    const sendMail = jest.fn().mockResolvedValue(undefined);
    const transporter = {
      sendMail,
    } as unknown as ReturnType<typeof nodemailer.createTransport>;
    jest.mocked(nodemailer.createTransport).mockReturnValue(transporter);
    const config = {
      get: jest.fn((key: string) => {
        const values: Record<string, string> = {
          MAIL_HOST: 'smtp.test',
          MAIL_PORT: '587',
          MAIL_USER: 'smtp-user',
          MAIL_PASSWORD: 'smtp-password',
          MAIL_FROM: 'noreply@example.com',
        };
        return values[key];
      }),
    } as unknown as ConfigService;
    const service = new MailService(config);

    await service.sendOperationalAlert('operations@example.com', {
      module: 'HealthService',
      operation: 'checkDatabaseConnection',
      failureCount: 5,
      windowSeconds: 300,
      detectedAt: new Date('2026-10-15T12:00:00.000Z'),
      errorType: 'Error',
      errorCode: 'ECONNREFUSED',
    });

    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'operations@example.com',
        subject: '[Bond] Errores operativos repetidos',
      }),
    );
    expect(JSON.stringify(sendMail.mock.calls)).toContain(
      'Operación: checkDatabaseConnection',
    );
    expect(JSON.stringify(sendMail.mock.calls)).not.toContain('smtp-password');
  });
});
