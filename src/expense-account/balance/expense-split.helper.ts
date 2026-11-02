import type { ExpenseShareData } from '../interface/account-movement.interface';

/**
 * Divide un importe en partes iguales entre los participantes.
 * Los centavos sobrantes del redondeo se asignan de a uno a los primeros
 * participantes, de modo que las partes siempre suman el total.
 */
export function splitEqually(
  totalCents: number,
  memberIds: number[],
): ExpenseShareData[] {
  if (memberIds.length === 0) {
    throw new Error('Se requiere al menos un participante para el reparto.');
  }

  const base = Math.floor(totalCents / memberIds.length);
  const remainder = totalCents % memberIds.length;

  return memberIds.map((memberId, index) => ({
    memberId,
    amountCents: base + (index < remainder ? 1 : 0),
  }));
}
