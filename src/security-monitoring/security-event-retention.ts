export const SECURITY_EVENT_RETENTION_DAYS = 90;

export function getSecurityEventRetentionCutoff(now: Date): Date {
  return new Date(
    now.getTime() - SECURITY_EVENT_RETENTION_DAYS * 24 * 60 * 60 * 1000,
  );
}
