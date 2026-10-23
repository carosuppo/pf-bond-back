import { Injectable, OnApplicationShutdown } from '@nestjs/common';
import { flushPersistentLogs } from './persistent-log-storage';

@Injectable()
export class PersistentLogShutdownService implements OnApplicationShutdown {
  async onApplicationShutdown(): Promise<void> {
    await flushPersistentLogs();
  }
}
