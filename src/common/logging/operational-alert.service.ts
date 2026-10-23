import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MailService } from '../../mail/mail.service';
import {
  logErrorSafely,
  logSafely,
  observeOperationalErrors,
} from './error-logging';
import type { OperationalErrorEvent } from './error-logging';

interface ErrorWindow {
  timestamps: number[];
  lastAlertAt?: number;
}

@Injectable()
export class OperationalAlertService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OperationalAlertService.name);
  private readonly recipient: string | undefined;
  private readonly threshold: number;
  private readonly windowSeconds: number;
  private readonly cooldownSeconds: number;
  private readonly errorWindows = new Map<string, ErrorWindow>();
  private readonly stopObserving: () => void;

  constructor(
    configService: ConfigService,
    private readonly mailService: MailService,
  ) {
    this.recipient =
      configService.get<string>('OPERATIONS_ALERT_EMAIL')?.trim() || undefined;
    this.threshold = this.getPositiveInteger(
      configService,
      'OPERATIONS_ALERT_THRESHOLD',
      5,
    );
    this.windowSeconds = this.getPositiveInteger(
      configService,
      'OPERATIONS_ALERT_WINDOW_SECONDS',
      300,
    );
    this.cooldownSeconds = this.getPositiveInteger(
      configService,
      'OPERATIONS_ALERT_COOLDOWN_SECONDS',
      1800,
    );
    this.stopObserving = observeOperationalErrors((event) =>
      this.recordFailure(event),
    );
  }

  onModuleInit(): void {
    if (!this.recipient) {
      logSafely(
        this.logger,
        'warn',
        'operation=configureOperationalAlerts outcome=disabled reason=missingRecipient',
      );
    }
  }

  onModuleDestroy(): void {
    this.stopObserving();
  }

  private recordFailure(event: OperationalErrorEvent): void {
    if (
      !this.recipient ||
      event.module === MailService.name ||
      event.module === OperationalAlertService.name
    ) {
      return;
    }

    const now = Date.now();
    const windowStart = now - this.windowSeconds * 1000;
    const key = `${event.module}:${event.operation}`;
    const currentWindow = this.errorWindows.get(key) ?? { timestamps: [] };
    currentWindow.timestamps = currentWindow.timestamps.filter(
      (timestamp) => timestamp >= windowStart,
    );
    currentWindow.timestamps.push(now);
    this.errorWindows.set(key, currentWindow);

    this.removeExpiredWindows(now, windowStart);

    if (currentWindow.timestamps.length < this.threshold) return;
    if (
      currentWindow.lastAlertAt !== undefined &&
      now - currentWindow.lastAlertAt < this.cooldownSeconds * 1000
    ) {
      return;
    }

    currentWindow.lastAlertAt = now;
    void this.mailService
      .sendOperationalAlert(this.recipient, {
        module: event.module,
        operation: event.operation,
        failureCount: currentWindow.timestamps.length,
        windowSeconds: this.windowSeconds,
        detectedAt: new Date(now),
        errorType: event.errorType,
        errorCode: event.errorCode,
      })
      .catch((error: unknown) => {
        logErrorSafely(
          this.logger,
          'operation=sendOperationalAlert outcome=error',
          error,
        );
      });
  }

  private removeExpiredWindows(now: number, windowStart: number): void {
    for (const [key, errorWindow] of this.errorWindows) {
      if (
        errorWindow.timestamps.length === 0 &&
        (errorWindow.lastAlertAt === undefined ||
          now - errorWindow.lastAlertAt >= this.cooldownSeconds * 1000)
      ) {
        this.errorWindows.delete(key);
      } else {
        errorWindow.timestamps = errorWindow.timestamps.filter(
          (timestamp) => timestamp >= windowStart,
        );
      }
    }
  }

  private getPositiveInteger(
    configService: ConfigService,
    key: string,
    defaultValue: number,
  ): number {
    const value = configService.get<string>(key);
    if (!value) return defaultValue;

    const parsedValue = Number(value);
    return Number.isSafeInteger(parsedValue) && parsedValue > 0
      ? parsedValue
      : defaultValue;
  }
}
