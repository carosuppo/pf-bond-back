import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  notifyGroupMembers(groupId: number, message: string): void {
    this.logger.log(`[grupo ${groupId}] ${message}`);
  }
}
