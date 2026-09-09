CREATE TYPE "NotificationType" AS ENUM ('POINT_OF_INTEREST_CREATED', 'POINT_OF_INTEREST_UPDATED', 'POINT_OF_INTEREST_ENTERED', 'POINT_OF_INTEREST_EXITED');
ALTER TABLE "User" ADD COLUMN "notificationsEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Member" ADD COLUMN "notificationsEnabled" BOOLEAN NOT NULL DEFAULT true;
CREATE TABLE "MemberNotificationPreference" (
  "id" SERIAL NOT NULL PRIMARY KEY,
  "memberId" INTEGER NOT NULL,
  "type" "NotificationType" NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MemberNotificationPreference_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "MemberNotificationPreference_memberId_type_key" ON "MemberNotificationPreference"("memberId", "type");
CREATE TABLE "PointOfInterestPresence" (
  "id" SERIAL NOT NULL PRIMARY KEY,
  "memberId" INTEGER NOT NULL,
  "pointOfInterestId" INTEGER NOT NULL,
  "isInside" BOOLEAN NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PointOfInterestPresence_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "PointOfInterestPresence_pointOfInterestId_fkey" FOREIGN KEY ("pointOfInterestId") REFERENCES "PointOfInterest"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "PointOfInterestPresence_memberId_pointOfInterestId_key" ON "PointOfInterestPresence"("memberId", "pointOfInterestId");
CREATE INDEX "PointOfInterestPresence_pointOfInterestId_idx" ON "PointOfInterestPresence"("pointOfInterestId");
