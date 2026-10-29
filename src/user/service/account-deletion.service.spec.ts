import { EventEmitter2 } from '@nestjs/event-emitter';
import type { IUserRepository } from '../repository/user.repository.interface';
import type { SupabaseStorageService } from '../storage/supabase-storage.service';
import {
  ACCOUNT_DELETED_EVENT,
  AccountDeletionService,
} from './account-deletion.service';

describe('AccountDeletionService', () => {
  it('publishes the event only after persistence succeeds', async () => {
    const removedMemberships = [{ groupId: 5, memberId: 3 }];
    const deleteAccount = jest.fn().mockResolvedValue(removedMemberships);
    const findById = jest
      .fn()
      .mockResolvedValue({ profilePhotoPath: 'users/7/profile.jpg' });
    const remove = jest.fn().mockResolvedValue(undefined);
    const emit = jest.fn();
    const service = new AccountDeletionService(
      { deleteAccount },
      { findById } as unknown as IUserRepository,
      { remove } as unknown as SupabaseStorageService,
      { emit } as unknown as EventEmitter2,
    );
    await service.deleteAccount(7);
    expect(findById).toHaveBeenCalledWith(7);
    expect(remove).toHaveBeenCalledWith('users/7/profile.jpg');
    expect(deleteAccount).toHaveBeenCalledWith(7);
    expect(emit).toHaveBeenCalledWith(ACCOUNT_DELETED_EVENT, {
      userId: 7,
      removedMemberships,
    });
    expect(deleteAccount.mock.invocationCallOrder[0]).toBeLessThan(
      emit.mock.invocationCallOrder[0],
    );
    expect(remove.mock.invocationCallOrder[0]).toBeLessThan(
      deleteAccount.mock.invocationCallOrder[0],
    );
  });

  it('does not publish the event after a rollback', async () => {
    const emit = jest.fn();
    const service = new AccountDeletionService(
      {
        deleteAccount: jest.fn().mockRejectedValue(new Error('rollback')),
      },
      {
        findById: jest.fn().mockResolvedValue({ profilePhotoPath: null }),
      } as unknown as IUserRepository,
      { remove: jest.fn() } as unknown as SupabaseStorageService,
      { emit } as unknown as EventEmitter2,
    );
    await expect(service.deleteAccount(7)).rejects.toThrow('rollback');
    expect(emit).not.toHaveBeenCalled();
  });

  it('keeps the committed deletion successful when event delivery throws', async () => {
    const deleteAccount = jest.fn().mockResolvedValue([]);
    const emit = jest.fn().mockImplementation(() => {
      throw new Error('socket failure');
    });
    const service = new AccountDeletionService(
      { deleteAccount },
      {
        findById: jest.fn().mockResolvedValue({ profilePhotoPath: null }),
      } as unknown as IUserRepository,
      { remove: jest.fn() } as unknown as SupabaseStorageService,
      { emit } as unknown as EventEmitter2,
    );

    await expect(service.deleteAccount(7)).resolves.toBeUndefined();
    expect(deleteAccount).toHaveBeenCalledWith(7);
    expect(emit).toHaveBeenCalledWith(ACCOUNT_DELETED_EVENT, {
      userId: 7,
      removedMemberships: [],
    });
  });

  it('does not delete the account if its profile photo cannot be removed', async () => {
    const deleteAccount = jest.fn();
    const service = new AccountDeletionService(
      { deleteAccount },
      {
        findById: jest.fn().mockResolvedValue({
          profilePhotoPath: 'users/7/profile.jpg',
        }),
      } as unknown as IUserRepository,
      {
        remove: jest.fn().mockRejectedValue(new Error('storage unavailable')),
      } as unknown as SupabaseStorageService,
      { emit: jest.fn() } as unknown as EventEmitter2,
    );

    await expect(service.deleteAccount(7)).rejects.toThrow(
      'storage unavailable',
    );
    expect(deleteAccount).not.toHaveBeenCalled();
  });
});
