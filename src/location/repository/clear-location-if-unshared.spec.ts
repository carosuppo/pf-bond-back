import { clearLocationIfUnshared } from './clear-location-if-unshared';

describe('clearLocationIfUnshared', () => {
  it('keeps the current location while a group still shares it', async () => {
    const transaction = {
      member: { findFirst: jest.fn().mockResolvedValue({ id: 2 }) },
      user: { findUnique: jest.fn(), update: jest.fn() },
      location: { deleteMany: jest.fn() },
    };

    await clearLocationIfUnshared(transaction as never, 7);

    expect(transaction.user.findUnique).not.toHaveBeenCalled();
    expect(transaction.location.deleteMany).not.toHaveBeenCalled();
  });

  it('removes the stored current location when no group shares it', async () => {
    const transaction = {
      member: { findFirst: jest.fn().mockResolvedValue(null) },
      user: {
        findUnique: jest.fn().mockResolvedValue({ locationId: 12 }),
        update: jest.fn().mockResolvedValue(undefined),
      },
      location: { deleteMany: jest.fn().mockResolvedValue({ count: 1 }) },
    };

    await clearLocationIfUnshared(transaction as never, 7);

    expect(transaction.user.update).toHaveBeenCalledWith({
      where: { id: 7 },
      data: { locationId: null },
    });
    expect(transaction.location.deleteMany).toHaveBeenCalledWith({
      where: {
        id: 12,
        pointOfInterest: { is: null },
        events: { none: {} },
      },
    });
  });

  it('does nothing when no current location is stored', async () => {
    const transaction = {
      member: { findFirst: jest.fn().mockResolvedValue(null) },
      user: {
        findUnique: jest.fn().mockResolvedValue({ locationId: null }),
        update: jest.fn(),
      },
      location: { deleteMany: jest.fn() },
    };

    await clearLocationIfUnshared(transaction as never, 7);

    expect(transaction.user.update).not.toHaveBeenCalled();
    expect(transaction.location.deleteMany).not.toHaveBeenCalled();
  });
});
