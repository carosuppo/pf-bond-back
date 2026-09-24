const INVITATION_CODE_PATTERN = /^[A-Z0-9]{6}$/;

export function normalizeInvitationCode(value: string): string {
  return value.trim().replaceAll('-', '').toUpperCase();
}

export function isValidInvitationCode(value: string): boolean {
  return INVITATION_CODE_PATTERN.test(normalizeInvitationCode(value));
}
