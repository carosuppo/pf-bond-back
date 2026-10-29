import type { Prisma } from '@prisma/client';

export async function clearLocationIfUnshared(
  transaction: Prisma.TransactionClient,
  userId: number,
): Promise<void> {
  const member = await transaction.member.findFirst({
    where: {
      userId,
      group: { deletedAt: null },
      OR: [
        { locationSharingEnabled: true },
        { group: { shareLocationMandatorily: true } },
      ],
    },
    select: { id: true },
  });
  if (member) return;

  const user = await transaction.user.findUnique({
    where: { id: userId },
    select: { locationId: true },
  });
  if (user?.locationId == null) return;

  await transaction.user.update({
    where: { id: userId },
    data: { locationId: null },
  });
  await transaction.location.deleteMany({
    where: {
      id: user.locationId,
      pointOfInterest: { is: null },
      events: { none: {} },
    },
  });
}
