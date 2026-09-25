CREATE TYPE "PointOfInterestValidity" AS ENUM ('PERMANENT', 'TWELVE_HOURS', 'ONE_DAY', 'THREE_DAYS');

ALTER TABLE "PointOfInterest" ADD COLUMN "validity" "PointOfInterestValidity" NOT NULL DEFAULT 'PERMANENT';

UPDATE "PointOfInterest"
SET "validity" = 'ONE_DAY'
WHERE "isTemporary" = true;

ALTER TABLE "PointOfInterest" DROP COLUMN "description";
ALTER TABLE "PointOfInterest" DROP COLUMN "isTemporary";
