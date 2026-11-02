import type { AccountMovementData } from '../interface/account-movement.interface';

export type BalanceStatus = 'A_FAVOR' | 'EN_CONTRA' | 'SALDADO';

export interface MemberBalance {
  memberId: number;
  balanceCents: number;
  status: BalanceStatus;
}

export interface MemberDebt {
  memberId: number;
  amountCents: number;
}

export function toBalanceStatus(balanceCents: number): BalanceStatus {
  if (balanceCents > 0) {
    return 'A_FAVOR';
  }

  if (balanceCents < 0) {
    return 'EN_CONTRA';
  }

  return 'SALDADO';
}

/**
 * Calcula el saldo neto vigente de cada miembro. Las participaciones actuales
 * sin pagar y los ajustes pendientes crean obligaciones; los pagos y ajustes
 * liquidados se conservan como historial sin volver a descontarse. Un saldo
 * positivo significa que el miembro tiene importe a favor.
 */
export function calculateBalances(
  memberIds: number[],
  movements: AccountMovementData[],
): MemberBalance[] {
  const balances = new Map<number, number>(
    memberIds.map((memberId) => [memberId, 0]),
  );

  for (const movement of movements) {
    if (movement.kind === 'EXPENSE') {
      const pendingShares = movement.shares.filter(
        (share) =>
          share.isCurrent !== false &&
          !share.isPaid &&
          share.memberId !== movement.payerMemberId,
      );
      const totalPending = pendingShares.reduce(
        (sum, share) => sum + share.amountCents,
        0,
      );

      if (balances.has(movement.payerMemberId)) {
        balances.set(
          movement.payerMemberId,
          (balances.get(movement.payerMemberId) as number) + totalPending,
        );
      }

      for (const share of pendingShares) {
        if (balances.has(share.memberId)) {
          balances.set(
            share.memberId,
            (balances.get(share.memberId) as number) - share.amountCents,
          );
        }
      }
    } else if (movement.kind === 'PAYMENT') {
      // Linked payments settle one participation, which is already excluded
      // from the pending expense shares above. Applying them here as well
      // would discount unrelated debts between the same members.
      if (movement.expenseShareId !== undefined) {
        continue;
      }

      if (balances.has(movement.fromMemberId)) {
        balances.set(
          movement.fromMemberId,
          (balances.get(movement.fromMemberId) as number) +
            movement.amountCents,
        );
      }

      if (balances.has(movement.toMemberId)) {
        balances.set(
          movement.toMemberId,
          (balances.get(movement.toMemberId) as number) - movement.amountCents,
        );
      }
    } else if (movement.status === 'PENDING') {
      if (balances.has(movement.creditorMemberId)) {
        balances.set(
          movement.creditorMemberId,
          (balances.get(movement.creditorMemberId) as number) +
            movement.amountCents,
        );
      }

      if (balances.has(movement.debtorMemberId)) {
        balances.set(
          movement.debtorMemberId,
          (balances.get(movement.debtorMemberId) as number) -
            movement.amountCents,
        );
      }
    }
  }

  return memberIds.map((memberId) => {
    const balanceCents = balances.get(memberId) as number;

    return {
      memberId,
      balanceCents,
      status: toBalanceStatus(balanceCents),
    };
  });
}

/**
 * Obligaciones pendientes a favor del miembro: participaciones actuales de sus
 * gastos y ajustes pendientes, agrupados por deudor.
 */
export function calculateDebtsToMember(
  movements: AccountMovementData[],
  memberId: number,
): MemberDebt[] {
  const owed = new Map<number, number>();

  for (const movement of movements) {
    if (movement.kind === 'EXPENSE') {
      if (movement.payerMemberId !== memberId) {
        continue;
      }

      for (const share of movement.shares) {
        if (
          share.isCurrent === false ||
          share.memberId === memberId ||
          share.isPaid
        ) {
          continue;
        }

        owed.set(
          share.memberId,
          (owed.get(share.memberId) ?? 0) + share.amountCents,
        );
      }
    } else if (
      movement.kind === 'PAYMENT' &&
      movement.toMemberId === memberId
    ) {
      if (movement.expenseShareId !== undefined) {
        continue;
      }

      owed.set(
        movement.fromMemberId,
        (owed.get(movement.fromMemberId) ?? 0) - movement.amountCents,
      );
    } else if (
      movement.kind === 'ADJUSTMENT' &&
      movement.status === 'PENDING' &&
      movement.creditorMemberId === memberId
    ) {
      owed.set(
        movement.debtorMemberId,
        (owed.get(movement.debtorMemberId) ?? 0) + movement.amountCents,
      );
    }
  }

  return [...owed.entries()]
    .filter(([, amountCents]) => amountCents > 0)
    .map(([debtorId, amountCents]) => ({
      memberId: debtorId,
      amountCents,
    }))
    .sort((a, b) => a.memberId - b.memberId);
}

/**
 * Obligaciones pendientes del miembro: sus participaciones actuales y ajustes
 * pendientes, agrupados por acreedor.
 */
export function calculateDebtsOfMember(
  movements: AccountMovementData[],
  memberId: number,
): MemberDebt[] {
  const owed = new Map<number, number>();

  for (const movement of movements) {
    if (movement.kind === 'EXPENSE') {
      if (movement.payerMemberId === memberId) {
        continue;
      }

      const share = movement.shares.find(
        (candidate) =>
          candidate.isCurrent !== false &&
          candidate.memberId === memberId &&
          !candidate.isPaid,
      );

      if (!share) {
        continue;
      }

      owed.set(
        movement.payerMemberId,
        (owed.get(movement.payerMemberId) ?? 0) + share.amountCents,
      );
    } else if (
      movement.kind === 'PAYMENT' &&
      movement.fromMemberId === memberId
    ) {
      if (movement.expenseShareId !== undefined) {
        continue;
      }

      owed.set(
        movement.toMemberId,
        (owed.get(movement.toMemberId) ?? 0) - movement.amountCents,
      );
    } else if (
      movement.kind === 'ADJUSTMENT' &&
      movement.status === 'PENDING' &&
      movement.debtorMemberId === memberId
    ) {
      owed.set(
        movement.creditorMemberId,
        (owed.get(movement.creditorMemberId) ?? 0) + movement.amountCents,
      );
    }
  }

  return [...owed.entries()]
    .filter(([, amountCents]) => amountCents > 0)
    .map(([creditorId, amountCents]) => ({
      memberId: creditorId,
      amountCents,
    }))
    .sort((a, b) => a.memberId - b.memberId);
}
