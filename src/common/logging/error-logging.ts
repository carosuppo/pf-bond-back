import { Logger } from '@nestjs/common';
import { persistLog } from './persistent-log-storage';

type LogLevel = 'error' | 'log' | 'warn';

export interface OperationalErrorEvent {
  module: string;
  operation: string;
  errorType: string;
  errorCode?: string;
}

type OperationalErrorObserver = (event: OperationalErrorEvent) => void;

let operationalErrorObserver: OperationalErrorObserver | undefined;

export function safeErrorDetails(error: unknown): string {
  const errorType =
    error instanceof Error ? sanitizeValue(error.name) : 'NonError';
  const errorCode = getErrorCode(error);

  return [
    `errorType=${errorType ?? 'Error'}`,
    ...(errorCode ? [`errorCode=${errorCode}`] : []),
  ].join(' ');
}

export function logSafely(
  logger: Logger,
  level: LogLevel,
  message: string,
): void {
  try {
    logger[level](message);
  } catch {
    persistSafely(logger, level, message);
    return;
  }

  persistSafely(logger, level, message);
}

export function logErrorSafely(
  logger: Logger,
  message: string,
  error: unknown,
): void {
  try {
    const errorDetails = safeErrorDetails(error);
    logSafely(logger, 'error', `${message} ${errorDetails}`);
    operationalErrorObserver?.({
      module: getLogModule(logger, message),
      operation: getOperation(message),
      errorType: getDetail(errorDetails, 'errorType') ?? 'Error',
      errorCode: getDetail(errorDetails, 'errorCode'),
    });
  } catch {
    return;
  }
}

export function observeOperationalErrors(
  observer: OperationalErrorObserver,
): () => void {
  operationalErrorObserver = observer;

  return () => {
    if (operationalErrorObserver === observer) {
      operationalErrorObserver = undefined;
    }
  };
}

function persistSafely(logger: Logger, level: LogLevel, message: string): void {
  try {
    persistLog({
      timestamp: new Date().toISOString(),
      level,
      module: getLogModule(logger, message),
      message,
    });
  } catch {
    return;
  }
}

function getLoggerContext(logger: Logger): string {
  const context = (logger as unknown as { context?: string }).context;
  return context && /^[A-Za-z0-9_./-]{1,80}$/.test(context)
    ? context
    : 'Application';
}

function getLogModule(logger: Logger, message: string): string {
  const moduleName = /(?:^|\s)module=([A-Za-z0-9_./-]{1,80})/.exec(
    message,
  )?.[1];
  return moduleName ?? getLoggerContext(logger);
}

function getOperation(message: string): string {
  const operation = /(?:^|\s)operation=([A-Za-z0-9_./-]{1,80})/.exec(
    message,
  )?.[1];
  return operation ?? 'unknown';
}

function getDetail(details: string, key: string): string | undefined {
  return new RegExp(`(?:^|\\s)${key}=([A-Za-z0-9_./-]{1,80})`).exec(
    details,
  )?.[1];
}

function getErrorCode(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null || !('code' in error)) {
    return undefined;
  }

  const code = error.code;
  return typeof code === 'string' ? sanitizeValue(code) : undefined;
}

function sanitizeValue(value: string): string | undefined {
  return /^[A-Za-z0-9_./-]{1,80}$/.test(value) ? value : undefined;
}
