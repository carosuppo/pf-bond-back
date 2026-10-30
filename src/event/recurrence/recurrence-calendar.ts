import { EventRecurrenceFrequency } from '@prisma/client';

// Bond uses the Buenos Aires civil calendar (UTC-03:00).
const OFFSET = -180 * 60_000;
export function occurrenceAt(
  start: Date,
  frequency: EventRecurrenceFrequency,
  index: number,
): Date {
  const local = new Date(start.getTime() + OFFSET);
  if (frequency === 'MONTHLY') {
    const day = local.getUTCDate();
    local.setUTCDate(1);
    local.setUTCMonth(local.getUTCMonth() + index);
    const last = new Date(
      Date.UTC(local.getUTCFullYear(), local.getUTCMonth() + 1, 0),
    ).getUTCDate();
    local.setUTCDate(Math.min(day, last));
  } else {
    local.setUTCDate(
      local.getUTCDate() + index * (frequency === 'WEEKLY' ? 7 : 1),
    );
  }
  return new Date(local.getTime() - OFFSET);
}

export function occurrenceDates(
  start: Date,
  frequency: EventRecurrenceFrequency,
  until: Date | null,
  from: Date,
  through: Date,
): Date[] {
  const result: Date[] = [];
  const localStart = new Date(start.getTime() + OFFSET);
  const localFrom = new Date(from.getTime() + OFFSET);
  let index =
    frequency === 'MONTHLY'
      ? (localFrom.getUTCFullYear() - localStart.getUTCFullYear()) * 12 +
        localFrom.getUTCMonth() -
        localStart.getUTCMonth() -
        1
      : Math.floor(
          (from.getTime() - start.getTime()) /
            (86_400_000 * (frequency === 'WEEKLY' ? 7 : 1)),
        ) - 1;
  index = Math.max(0, index);
  for (; ; index++) {
    const date = occurrenceAt(start, frequency, index);
    if (date > through || (until && date > until)) break;
    if (date >= from) result.push(date);
  }
  return result;
}

export function calendarRange(
  year: number,
  month?: number,
): { from: Date; through: Date } {
  return {
    from: new Date(
      Date.UTC(year, month === undefined ? 0 : month - 1, 1) - OFFSET,
    ),
    through: new Date(
      Date.UTC(year, month === undefined ? 12 : month, 1) - OFFSET - 1,
    ),
  };
}
