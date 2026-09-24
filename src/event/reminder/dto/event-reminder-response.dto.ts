export class EventReminderResponseDto {
  id!: number;
  leadMinutes!: number;
  remindAt!: Date;
  sentAt!: Date | null;
}

export class EventRemindersResponseDto {
  reminders!: EventReminderResponseDto[];
}
