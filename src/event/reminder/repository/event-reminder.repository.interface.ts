export interface EventReminderRecord {
  id: number;
  eventId: number;
  memberId: number;
  leadMinutes: number;
  remindAt: Date;
  sentAt: Date | null;
  utcOffsetMinutes: number | null;
}

export interface EventReminderInput {
  leadMinutes: number;
  remindAt: Date;
  utcOffsetMinutes: number | null;
}

export interface DueEventReminder {
  id: number;
  eventId: number;
  eventName: string;
  eventStartAt: Date;
  leadMinutes: number;
  groupId: number;
  memberId: number;
  userId: number;
  utcOffsetMinutes: number | null;
}

export interface IEventReminderRepository {
  findByEventAndMember(
    eventId: number,
    memberId: number,
  ): Promise<EventReminderRecord[]>;
  replace(
    eventId: number,
    memberId: number,
    inputs: EventReminderInput[],
  ): Promise<EventReminderRecord[]>;
  deleteByEventAndMember(eventId: number, memberId: number): Promise<number>;
  deleteByEventAndMembersNotIn(
    eventId: number,
    memberIds: number[],
  ): Promise<number>;
  rescheduleUnsent(eventId: number, startAt: Date): Promise<number>;
  claimDue(now: Date): Promise<DueEventReminder[]>;
  purgeExpired(now: Date): Promise<number>;
}
