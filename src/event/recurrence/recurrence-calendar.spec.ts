import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateEventDto } from '../dto/create-event.dto';
import {
  calendarRange,
  occurrenceAt,
  occurrenceDates,
} from './recurrence-calendar';

describe('Recurrence calendar and request validation', () => {
  const start = new Date('2030-02-01T01:30:00Z'); // January 31, 22:30 in Bond.
  it.each(['DAILY', 'WEEKLY', 'MONTHLY'] as const)(
    'preserves civil time for %s',
    (frequency) => {
      expect(occurrenceAt(start, frequency, 1).getUTCHours()).toBe(1);
      expect(occurrenceAt(start, frequency, 1).getUTCMinutes()).toBe(30);
    },
  );
  it('clamps February and restores January 31 as the anchor in March', () => {
    expect(occurrenceAt(start, 'MONTHLY', 1).toISOString()).toBe(
      '2030-03-01T01:30:00.000Z',
    );
    expect(occurrenceAt(start, 'MONTHLY', 2).toISOString()).toBe(
      '2030-04-01T01:30:00.000Z',
    );
    expect(
      occurrenceAt(new Date('2032-01-31T15:00Z'), 'MONTHLY', 1).toISOString(),
    ).toBe('2032-02-29T15:00:00.000Z');
  });
  it('includes until and bounds open series to the requested window', () => {
    const end = occurrenceAt(start, 'DAILY', 2);
    expect(
      occurrenceDates(
        start,
        'DAILY',
        end,
        start,
        occurrenceAt(start, 'DAILY', 60),
      ),
    ).toHaveLength(3);
    expect(
      occurrenceDates(
        start,
        'DAILY',
        null,
        start,
        occurrenceAt(start, 'DAILY', 60),
      ),
    ).toHaveLength(61);
    const { from, through } = calendarRange(2040, 2);
    expect(occurrenceDates(start, 'DAILY', null, from, through)).toHaveLength(
      29,
    );
  });
  it.each([
    { frequency: 'YEARLY' },
    { frequency: 'DAILY', until: 'invalid' },
    {},
    'DAILY',
    [],
  ])('rejects malformed recurrence %j', async (recurrence) => {
    const dto = plainToInstance(CreateEventDto, {
      name: 'Test',
      startAt: '2090-01-01T12:00Z',
      memberIds: [],
      recurrence,
    });
    expect((await validate(dto)).length).toBeGreaterThan(0);
  });
  it('accepts normal events and null end dates', async () => {
    for (const recurrence of [
      undefined,
      { frequency: 'WEEKLY', until: null },
    ]) {
      expect(
        await validate(
          plainToInstance(CreateEventDto, {
            name: 'Test',
            startAt: '2090-01-01T12:00Z',
            memberIds: [],
            recurrence,
          }),
        ),
      ).toEqual([]);
    }
  });
});
