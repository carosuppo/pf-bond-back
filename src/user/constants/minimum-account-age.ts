export const MINIMUM_ACCOUNT_AGE_YEARS = 13;
export const AGE_VERIFICATION_REQUIRED_MESSAGE = 'AGE_VERIFICATION_REQUIRED';
export const MINIMUM_AGE_RESTRICTION_MESSAGE =
  'La fecha ingresada no pudo ser validada.';

export function meetsMinimumAccountAge(
  birthDate: string,
  today = new Date(),
): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) return false;

  const [year, month, day] = birthDate.split('-').map(Number);
  const parsedBirthDate = new Date(Date.UTC(year, month - 1, day));
  if (
    parsedBirthDate.getUTCFullYear() !== year ||
    parsedBirthDate.getUTCMonth() !== month - 1 ||
    parsedBirthDate.getUTCDate() !== day ||
    parsedBirthDate > today
  ) {
    return false;
  }

  let age = today.getUTCFullYear() - year;
  if (
    today.getUTCMonth() < month - 1 ||
    (today.getUTCMonth() === month - 1 && today.getUTCDate() < day)
  ) {
    age--;
  }

  return age >= MINIMUM_ACCOUNT_AGE_YEARS;
}
