import { appendFile, mkdir, readdir, stat, unlink } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';

export interface PersistentLogEntry {
  timestamp: string;
  level: string;
  module: string;
  message: string;
}

interface LogFile {
  path: string;
  name: string;
  index: number;
  size: number;
}

const fileNamePattern = /^bond-(\d{4}-\d{2}-\d{2})-(\d+)\.log$/;
let writeQueue: Promise<void> = Promise.resolve();
let pendingWrites = 0;
let currentFile: LogFile | undefined;
let lastCleanupKey: string | undefined;

export function persistLog(entry: PersistentLogEntry): void {
  if (process.env.NODE_ENV === 'test' && !process.env.LOG_DIRECTORY) return;
  if (pendingWrites >= 10000) return;

  try {
    const line = `${JSON.stringify(entry)}\n`;
    pendingWrites += 1;
    writeQueue = writeQueue
      .then(() => writeEntry(entry.timestamp, line))
      .catch(() => undefined)
      .then(() => {
        pendingWrites -= 1;
      });
  } catch {
    return;
  }
}

export async function flushPersistentLogs(): Promise<void> {
  await writeQueue.catch(() => undefined);
}

async function writeEntry(timestamp: string, line: string): Promise<void> {
  const directory = getLogDirectory();
  await mkdir(directory, { recursive: true });

  const date = timestamp.slice(0, 10);
  let rotated = false;
  let file = await getCurrentFile(directory, date);
  const lineSize = Buffer.byteLength(line);

  if (file.size > 0 && file.size + lineSize > getMaxFileSizeBytes()) {
    file = createNextFile(directory, date, file.index + 1);
    currentFile = file;
    rotated = true;
  }

  await appendFile(file.path, line, { encoding: 'utf8' });
  file.size += lineSize;

  const cleanupKey = `${directory}:${date}`;
  if (lastCleanupKey !== cleanupKey || rotated) {
    await removeExpiredFiles(directory);
    lastCleanupKey = cleanupKey;
  }
}

async function getCurrentFile(
  directory: string,
  date: string,
): Promise<LogFile> {
  if (
    currentFile &&
    dirname(currentFile.path) === directory &&
    currentFile.name.startsWith(`bond-${date}-`)
  ) {
    return currentFile;
  }

  const names = await readdir(directory);
  const files = names
    .map((name) => {
      const match = fileNamePattern.exec(name);
      if (!match || match[1] !== date) return undefined;

      return {
        name,
        index: Number(match[2]),
      };
    })
    .filter(
      (file): file is { name: string; index: number } => file !== undefined,
    )
    .sort((left, right) => right.index - left.index);

  const latest = files[0];
  if (!latest) {
    const file = createNextFile(directory, date, 1);
    currentFile = file;
    return file;
  }

  const path = join(directory, latest.name);
  const file = {
    path,
    name: latest.name,
    index: latest.index,
    size: (await stat(path)).size,
  };

  currentFile = file;
  return file;
}

function createNextFile(
  directory: string,
  date: string,
  index: number,
): LogFile {
  const name = `bond-${date}-${String(index).padStart(4, '0')}.log`;

  return {
    path: join(directory, name),
    name,
    index,
    size: 0,
  };
}

async function removeExpiredFiles(directory: string): Promise<void> {
  const names = await readdir(directory);
  const files: Array<{ name: string; path: string; modifiedAt: number }> = [];
  const expirationTime = Date.now() - getRetentionDays() * 24 * 60 * 60 * 1000;

  for (const name of names) {
    if (!fileNamePattern.test(name)) continue;

    const path = join(directory, name);
    const fileStats = await stat(path);

    if (fileStats.mtimeMs < expirationTime) {
      await unlink(path);
      if (currentFile?.path === path) currentFile = undefined;
      continue;
    }

    files.push({ name, path, modifiedAt: fileStats.mtimeMs });
  }

  files.sort((left, right) => {
    const order = left.modifiedAt - right.modifiedAt;
    return order === 0 ? left.name.localeCompare(right.name) : order;
  });

  const excessFiles = files.length - getMaxFiles();
  for (const file of files.slice(0, Math.max(0, excessFiles))) {
    await unlink(file.path);
    if (currentFile?.path === file.path) currentFile = undefined;
  }
}

function getLogDirectory(): string {
  const configuredDirectory = process.env.LOG_DIRECTORY?.trim();
  return resolve(configuredDirectory || join(process.cwd(), 'logs'));
}

function getRetentionDays(): number {
  return getPositiveInteger(process.env.LOG_RETENTION_DAYS, 30, 3650);
}

function getMaxFiles(): number {
  return getPositiveInteger(process.env.LOG_MAX_FILES, 40, 500);
}

function getMaxFileSizeBytes(): number {
  return (
    getPositiveInteger(process.env.LOG_MAX_FILE_SIZE_MB, 10, 1024) * 1024 * 1024
  );
}

function getPositiveInteger(
  value: string | undefined,
  defaultValue: number,
  maximum: number,
): number {
  if (!value) return defaultValue;

  const parsedValue = Number(value);
  return Number.isSafeInteger(parsedValue) &&
    parsedValue > 0 &&
    parsedValue <= maximum
    ? parsedValue
    : defaultValue;
}
