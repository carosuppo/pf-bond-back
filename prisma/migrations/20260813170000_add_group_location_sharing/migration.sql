ALTER TABLE "Member"
ADD COLUMN "locationSharingEnabled" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "Location"
ADD COLUMN "latitude" DOUBLE PRECISION,
ADD COLUMN "longitude" DOUBLE PRECISION,
ADD COLUMN "accuracy" DOUBLE PRECISION,
ADD COLUMN "capturedAt" TIMESTAMP(3);

UPDATE "Location"
SET
  "latitude" = CASE
    WHEN "coordinates" ~ '^\s*-?[0-9]+(\.[0-9]+)?\s*,\s*-?[0-9]+(\.[0-9]+)?\s*$'
    THEN split_part("coordinates", ',', 1)::DOUBLE PRECISION
    ELSE 0
  END,
  "longitude" = CASE
    WHEN "coordinates" ~ '^\s*-?[0-9]+(\.[0-9]+)?\s*,\s*-?[0-9]+(\.[0-9]+)?\s*$'
    THEN split_part("coordinates", ',', 2)::DOUBLE PRECISION
    ELSE 0
  END;

ALTER TABLE "Location"
ALTER COLUMN "latitude" SET NOT NULL,
ALTER COLUMN "longitude" SET NOT NULL,
DROP COLUMN "coordinates";
