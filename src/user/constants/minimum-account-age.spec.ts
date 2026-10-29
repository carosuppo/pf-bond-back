import { meetsMinimumAccountAge } from './minimum-account-age';

describe('meetsMinimumAccountAge', () => {
  const today = new Date('2026-10-28T12:00:00.000Z');

  it('allows a person who has turned 13', () => {
    expect(meetsMinimumAccountAge('2013-10-28', today)).toBe(true);
  });

  it('rejects a person whose 13th birthday is tomorrow', () => {
    expect(meetsMinimumAccountAge('2013-10-29', today)).toBe(false);
  });

  it('rejects invalid and future dates', () => {
    expect(meetsMinimumAccountAge('2013-02-30', today)).toBe(false);
    expect(meetsMinimumAccountAge('2027-01-01', today)).toBe(false);
    expect(meetsMinimumAccountAge('28/10/2013', today)).toBe(false);
  });
});
