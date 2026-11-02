-- CreateEnum
CREATE TYPE "EventRecurrenceFrequency" AS ENUM ('DAILY', 'WEEKLY', 'MONTHLY');

-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "occurrenceAt" TIMESTAMP(3),
ADD COLUMN     "recurrenceId" INTEGER;

-- CreateTable
CREATE TABLE "EventRecurrence" (
    "id" SERIAL NOT NULL,
    "frequency" "EventRecurrenceFrequency" NOT NULL,
    "until" TIMESTAMP(3),
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3),
    "name" TEXT NOT NULL,
    "description" TEXT,
    "groupId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventRecurrence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventRecurrenceMember" (
    "recurrenceId" INTEGER NOT NULL,
    "memberId" INTEGER NOT NULL,

    CONSTRAINT "EventRecurrenceMember_pkey" PRIMARY KEY ("recurrenceId","memberId")
);

-- CreateTable
CREATE TABLE "EventRecurrenceReminder" (
    "id" SERIAL NOT NULL,
    "recurrenceId" INTEGER NOT NULL,
    "memberId" INTEGER NOT NULL,
    "leadMinutes" INTEGER NOT NULL,
    "utcOffsetMinutes" INTEGER,

    CONSTRAINT "EventRecurrenceReminder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EventRecurrence_groupId_idx" ON "EventRecurrence"("groupId");

-- CreateIndex
CREATE INDEX "EventRecurrenceMember_memberId_idx" ON "EventRecurrenceMember"("memberId");

-- CreateIndex
CREATE INDEX "EventRecurrenceReminder_memberId_idx" ON "EventRecurrenceReminder"("memberId");

-- CreateIndex
CREATE INDEX "Event_groupId_startAt_idx" ON "Event"("groupId", "startAt");

-- CreateIndex
CREATE UNIQUE INDEX "Event_recurrenceId_occurrenceAt_key" ON "Event"("recurrenceId", "occurrenceAt");

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_recurrenceId_fkey" FOREIGN KEY ("recurrenceId") REFERENCES "EventRecurrence"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventRecurrence" ADD CONSTRAINT "EventRecurrence_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventRecurrenceMember" ADD CONSTRAINT "EventRecurrenceMember_recurrenceId_fkey" FOREIGN KEY ("recurrenceId") REFERENCES "EventRecurrence"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventRecurrenceMember" ADD CONSTRAINT "EventRecurrenceMember_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventRecurrenceReminder" ADD CONSTRAINT "EventRecurrenceReminder_recurrenceId_fkey" FOREIGN KEY ("recurrenceId") REFERENCES "EventRecurrence"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventRecurrenceReminder" ADD CONSTRAINT "EventRecurrenceReminder_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE UNIQUE INDEX "EventRecurrenceReminder_recurrenceId_memberId_leadMinutes_key" ON "EventRecurrenceReminder"("recurrenceId", "memberId", "leadMinutes");
