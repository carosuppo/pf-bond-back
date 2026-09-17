-- Preserve the meaning of previously deleted accounts before removing the flag.
-- The entire cleanup and schema change commit together.
BEGIN;

DO $$
DECLARE
  legacy_user RECORD;
  membership RECORD;
  candidate RECORD;
  other_count INTEGER;
  location_ids INTEGER[];
  location_id INTEGER;
BEGIN
  FOR legacy_user IN
    SELECT id, "locationId" FROM "User" WHERE "deletedAt" IS NOT NULL ORDER BY id
  LOOP
    location_ids := ARRAY[]::INTEGER[];
    IF legacy_user."locationId" IS NOT NULL THEN
      location_ids := array_append(location_ids, legacy_user."locationId");
    END IF;

    FOR membership IN
      SELECT id, "groupId" FROM "Member"
      WHERE "userId" = legacy_user.id ORDER BY "groupId"
    LOOP
      SELECT count(*) INTO other_count FROM "Member"
      WHERE "groupId" = membership."groupId" AND id <> membership.id;

      IF other_count = 0 THEN
        FOR candidate IN
          SELECT "locationId" AS id FROM "Event" WHERE "groupId" = membership."groupId"
          UNION
          SELECT "locationId" AS id FROM "PointOfInterest" WHERE "groupId" = membership."groupId"
        LOOP
          IF candidate.id IS NOT NULL THEN
            location_ids := array_append(location_ids, candidate.id);
          END IF;
        END LOOP;

        -- EventMember, PointOfInterestPresence and member preferences cascade.
        DELETE FROM "Event" WHERE "groupId" = membership."groupId";
        DELETE FROM "Reminder" WHERE "groupId" = membership."groupId";
        DELETE FROM "PointOfInterest" WHERE "groupId" = membership."groupId";
        DELETE FROM "Member" WHERE id = membership.id;
        DELETE FROM "Group" WHERE id = membership."groupId";
      ELSE
        IF NOT EXISTS (
          SELECT 1 FROM "Member"
          WHERE "groupId" = membership."groupId"
            AND id <> membership.id AND role = 'ADMIN'
        ) THEN
          UPDATE "Member" SET role = 'ADMIN'
          WHERE id = (
            SELECT min(id) FROM "Member"
            WHERE "groupId" = membership."groupId" AND id <> membership.id
          );
        END IF;
        DELETE FROM "Member" WHERE id = membership.id;
      END IF;
    END LOOP;

    -- UserSession, EmailVerificationToken and DevicePushToken cascade.
    DELETE FROM "User" WHERE id = legacy_user.id;
    FOREACH location_id IN ARRAY location_ids LOOP
      DELETE FROM "Location" WHERE id = location_id
        AND NOT EXISTS (SELECT 1 FROM "User" WHERE "locationId" = location_id)
        AND NOT EXISTS (SELECT 1 FROM "PointOfInterest" WHERE "locationId" = location_id)
        AND NOT EXISTS (SELECT 1 FROM "Event" WHERE "locationId" = location_id);
    END LOOP;
  END LOOP;
END $$;

ALTER TABLE "User" DROP COLUMN "deletedAt";

COMMIT;
