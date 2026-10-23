import { Logger } from '@nestjs/common';
import {
  mkdtemp,
  readFile,
  readdir,
  rm,
  utimes,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { flushPersistentLogs } from './persistent-log-storage';
import {
  logErrorSafely,
  logSafely,
  observeOperationalErrors,
} from './error-logging';

describe('error logging', () => {
  let logDirectory: string;
  let previousLogDirectory: string | undefined;
  let previousMaxFileSize: string | undefined;

  beforeEach(async () => {
    previousLogDirectory = process.env.LOG_DIRECTORY;
    previousMaxFileSize = process.env.LOG_MAX_FILE_SIZE_MB;
    logDirectory = await mkdtemp(join(tmpdir(), 'bond-logs-'));
    process.env.LOG_DIRECTORY = logDirectory;
  });

  afterEach(async () => {
    await flushPersistentLogs();
    if (previousLogDirectory === undefined) {
      delete process.env.LOG_DIRECTORY;
    } else {
      process.env.LOG_DIRECTORY = previousLogDirectory;
    }
    if (previousMaxFileSize === undefined) {
      delete process.env.LOG_MAX_FILE_SIZE_MB;
    } else {
      process.env.LOG_MAX_FILE_SIZE_MB = previousMaxFileSize;
    }
    await rm(logDirectory, { recursive: true, force: true });
  });

  it('logs a safe error type and code without the error message', () => {
    const logger = new Logger('TestLogger');
    const log = jest.spyOn(logger, 'error').mockImplementation(() => undefined);
    const error = Object.assign(
      new Error('password=secret token=private email=person@example.com'),
      { code: 'ECONNREFUSED' },
    );

    logErrorSafely(logger, 'operation=connect outcome=error', error);

    expect(log).toHaveBeenCalledWith(
      'operation=connect outcome=error errorType=Error errorCode=ECONNREFUSED',
    );
    expect(log.mock.calls[0][0]).not.toContain('secret');
    expect(log.mock.calls[0][0]).not.toContain('person@example.com');
  });

  it('does not throw when the logger itself fails', () => {
    const logger = new Logger('TestLogger');
    jest.spyOn(logger, 'error').mockImplementation(() => {
      throw new Error('logging failure');
    });

    expect(() =>
      logErrorSafely(logger, 'operation=connect outcome=error', new Error()),
    ).not.toThrow();
  });

  it('persists safe structured records with module and operation details', async () => {
    const logger = new Logger('DatabaseModule');
    const observer = jest.fn();
    const stopObserving = observeOperationalErrors(observer);
    const error = Object.assign(new Error('password=secret token=private'), {
      code: 'ECONNREFUSED',
    });

    logErrorSafely(logger, 'operation=connect outcome=error', error);
    stopObserving();
    await flushPersistentLogs();

    const [fileName] = await readdir(logDirectory);
    const content = await readFile(join(logDirectory, fileName), 'utf8');
    const record = JSON.parse(content) as {
      level: string;
      module: string;
      message: string;
    };

    expect(record).toMatchObject({
      level: 'error',
      module: 'DatabaseModule',
      message:
        'operation=connect outcome=error errorType=Error errorCode=ECONNREFUSED',
    });
    expect(content).not.toContain('secret');
    expect(content).not.toContain('private');
    expect(observer).toHaveBeenCalledWith({
      module: 'DatabaseModule',
      operation: 'connect',
      errorType: 'Error',
      errorCode: 'ECONNREFUSED',
    });
  });

  it('removes log files past the retention period', async () => {
    const expiredFile = join(logDirectory, 'bond-2000-01-01-0001.log');
    const expiredAt = new Date('2000-01-01T00:00:00.000Z');
    await writeFile(expiredFile, 'expired');
    await utimes(expiredFile, expiredAt, expiredAt);

    logErrorSafely(
      new Logger('RetentionModule'),
      'operation=cleanup outcome=check',
      new Error(),
    );
    await flushPersistentLogs();

    const files = await readdir(logDirectory);
    expect(files).not.toContain('bond-2000-01-01-0001.log');
    expect(files).toHaveLength(1);
  });

  it('rotates files after reaching the configured size limit', async () => {
    process.env.LOG_MAX_FILE_SIZE_MB = '1';
    const logger = new Logger('RotationModule');
    jest.spyOn(logger, 'log').mockImplementation(() => undefined);
    const message = 'x'.repeat(600 * 1024);

    logSafely(logger, 'log', message);
    logSafely(logger, 'log', message);
    await flushPersistentLogs();

    expect(await readdir(logDirectory)).toHaveLength(2);
  });
});
