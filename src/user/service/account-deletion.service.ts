import { Inject, Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { logErrorSafely } from '../../common/logging/error-logging';
import type { IUserRepository } from '../repository/user.repository.interface';
import type {
  IAccountDeletionRepository,
  RemovedMembership,
} from '../repository/account-deletion.repository.interface';
import { SupabaseStorageService } from '../storage/supabase-storage.service';

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
    @Inject('userRepository')
    private readonly userRepository: IUserRepository,
    private readonly storage: SupabaseStorageService,
    private readonly events: EventEmitter2,
  ) {}

  async deleteAccount(userId: number): Promise<void> {
    const user = await this.userRepository.findById(userId);
    if (user?.profilePhotoPath)
      await this.storage.remove(user.profilePhotoPath);
    const removedMemberships = await this.repository.deleteAccount(userId);
    try {
      this.events.emit(ACCOUNT_DELETED_EVENT, { userId, removedMemberships });
    } catch (error: unknown) {
      logErrorSafely(
        this.logger,
        'operation=publishAccountDeletedEvent outcome=error',
        error,
      );
    }
  }
}
