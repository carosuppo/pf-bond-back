export class EventValidator {
  isFutureDate(date: Date): boolean {
    return date.getTime() > Date.now();
  }

  isAfterDate(date: Date, referenceDate: Date): boolean {
    return date.getTime() > referenceDate.getTime();
  }
}
