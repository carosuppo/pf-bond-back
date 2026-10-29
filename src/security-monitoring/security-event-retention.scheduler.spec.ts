import {
  SECURITY_EVENT_RETENTION_DAYS,
  getSecurityEventRetentionCutoff,
} from './security-event-retention';

describe('security event retention', () => {
  it('calculates the 90-day retention cutoff', () => {
    const now = new Date('2026-10-28T12:00:00.000Z');
    const cutoff = getSecurityEventRetentionCutoff(now);

    expect(now.getTime() - cutoff.getTime()).toBe(
      SECURITY_EVENT_RETENTION_DAYS * 24 * 60 * 60 * 1000,
    );
  });
});
