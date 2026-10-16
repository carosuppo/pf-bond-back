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
 * Calcula el saldo neto de cada miembro: lo pagado menos lo que le
 * corresponde aportar, más lo cobrado menos lo pagado en pagos directos.
 * Un saldo positivo significa que el miembro tiene importe a favor.
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
      const total = movement.shares.reduce(
        (sum, share) => sum + share.amountCents,
        0,
      );
      const payerShare =
        movement.shares.find(
          (share) => share.memberId === movement.payerMemberId,
        )?.amountCents ?? 0;

      if (balances.has(movement.payerMemberId)) {
        balances.set(
          movement.payerMemberId,
          (balances.get(movement.payerMemberId) as number) +
            (total - payerShare),
        );
      }

      for (const share of movement.shares) {
        if (share.memberId === movement.payerMemberId) {
          continue;
        }

        if (balances.has(share.memberId)) {
          balances.set(
            share.memberId,
            (balances.get(share.memberId) as number) - share.amountCents,
          );
        }
      }
    } else {
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
 * Importes que le deben al miembro indicado: partes impagas de los gastos
 * que pagó, menos los pagos que ya recibió. El dinero es fungible, por lo
 * que los pagos se descuentan del total adeudado por cada deudor.
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
        if (share.memberId === memberId) {
          continue;
        }

        owed.set(
          share.memberId,
          (owed.get(share.memberId) ?? 0) + share.amountCents,
        );
      }
    } else if (movement.toMemberId === memberId) {
      owed.set(
        movement.fromMemberId,
        (owed.get(movement.fromMemberId) ?? 0) - movement.amountCents,
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
 * Importes que el miembro indicado debe pagar: sus partes impagas en gastos
 * pagados por otros (memberId = acreedor), menos los pagos que ya realizó.
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
        (candidate) => candidate.memberId === memberId,
      );

      if (!share) {
        continue;
      }

      owed.set(
        movement.payerMemberId,
        (owed.get(movement.payerMemberId) ?? 0) + share.amountCents,
      );
    } else if (movement.fromMemberId === memberId) {
      owed.set(
        movement.toMemberId,
        (owed.get(movement.toMemberId) ?? 0) - movement.amountCents,
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
