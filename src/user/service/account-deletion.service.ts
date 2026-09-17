import { Inject, Injectable } from '@nestjs/common';
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
  constructor(
    @Inject('accountDeletionRepository')
    private readonly repository: IAccountDeletionRepository,
    private readonly events: EventEmitter2,
  ) {}

  async deleteAccount(userId: number): Promise<void> {
    const removedMemberships = await this.repository.deleteAccount(userId);
    this.events.emit(ACCOUNT_DELETED_EVENT, { userId, removedMemberships });
  }
}
