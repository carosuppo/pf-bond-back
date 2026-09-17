import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  ACCOUNT_DELETED_EVENT,
  AccountDeletionService,
} from './account-deletion.service';

describe('AccountDeletionService', () => {
  it('publishes the event only after persistence succeeds', async () => {
    const removedMemberships = [{ groupId: 5, memberId: 3 }];
    const deleteAccount = jest.fn().mockResolvedValue(removedMemberships);
    const emit = jest.fn();
    const service = new AccountDeletionService({ deleteAccount }, {
      emit,
    } as unknown as EventEmitter2);
    await service.deleteAccount(7);
    expect(deleteAccount).toHaveBeenCalledWith(7);
    expect(emit).toHaveBeenCalledWith(ACCOUNT_DELETED_EVENT, {
      userId: 7,
      removedMemberships,
    });
    expect(deleteAccount.mock.invocationCallOrder[0]).toBeLessThan(
      emit.mock.invocationCallOrder[0],
    );
  });

  it('does not publish the event after a rollback', async () => {
    const emit = jest.fn();
    const service = new AccountDeletionService(
      { deleteAccount: jest.fn().mockRejectedValue(new Error('rollback')) },
      { emit } as unknown as EventEmitter2,
    );
    await expect(service.deleteAccount(7)).rejects.toThrow('rollback');
    expect(emit).not.toHaveBeenCalled();
  });
});
