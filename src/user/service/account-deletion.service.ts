import { Inject, Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import type {
  IAccountDeletionRepository,
  RemovedMembership,
} from '../repository/account-deletion.repository.interface';

export const ACCOUNT_DELETED_EVENT = 'account.deleted';

export interface AccountDeletedEvent {
  userId: number;
  removedMemberships: RemovedMembership[];
}

@Injectable()
export class AccountDeletionService {
  private readonly logger = new Logger(AccountDeletionService.name);

  constructor(
    @Inject('accountDeletionRepository')
    private readonly repository: IAccountDeletionRepository,
    private readonly events: EventEmitter2,
  ) {}

  async deleteAccount(userId: number): Promise<void> {
    const removedMemberships = await this.repository.deleteAccount(userId);
    try {
      this.events.emit(ACCOUNT_DELETED_EVENT, { userId, removedMemberships });
    } catch (error) {
      this.logger.error(
        'Account deletion side effect failed after commit',
        error,
      );
    }
  }
}
