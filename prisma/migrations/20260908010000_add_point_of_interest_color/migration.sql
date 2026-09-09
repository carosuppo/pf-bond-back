CREATE TYPE "PointOfInterestColor" AS ENUM ('RED', 'GREEN', 'ORANGE', 'BLUE', 'PURPLE', 'GREY', 'BLACK');

ALTER TABLE "PointOfInterest" ADD COLUMN "color" "PointOfInterestColor" NOT NULL DEFAULT 'BLUE';
