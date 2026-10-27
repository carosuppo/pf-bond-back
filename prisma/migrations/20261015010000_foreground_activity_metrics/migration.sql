BEGIN;

-- Old timestamps represented operations, not foreground usage. Start fresh.
UPDATE public."User" SET "lastActivityAt" = NULL WHERE "lastActivityAt" IS NOT NULL;

-- Preserve ownership, grants and dependencies; do not drop the private view.
ALTER VIEW bond_metrics.sprint6 RENAME COLUMN weekly_active_users_observed TO weekly_active_users_foreground;

CREATE OR REPLACE VIEW bond_metrics.sprint6 WITH (security_barrier = true) AS
WITH clock AS (
  SELECT timezone('UTC', statement_timestamp()) AS now
), active_groups AS MATERIALIZED (
  SELECT id, "shareLocationMandatorily" FROM public."Group"
  WHERE "deletedAt" IS NULL
), user_sharing AS (
  SELECT u."locationId", u."lastActivityAt", EXISTS (
    SELECT 1 FROM public."Member" m JOIN active_groups g ON g.id = m."groupId"
    WHERE m."userId" = u.id
      AND (m."locationSharingEnabled" OR g."shareLocationMandatorily")
  ) AS shares_location
  FROM public."User" u
), user_counts AS (
  SELECT count(*) AS total_users,
    count(*) FILTER (WHERE u.shares_location) AS users_sharing_location,
    count(*) FILTER (WHERE u."lastActivityAt" > c.now - interval '7 days'
      AND u."lastActivityAt" <= c.now) AS weekly_active_users_foreground,
    count(*) FILTER (WHERE l."capturedAt" > c.now - interval '15 minutes'
      AND l."capturedAt" <= c.now AND u.shares_location) AS users_with_recent_location
  FROM user_sharing u LEFT JOIN public."Location" l ON l.id = u."locationId"
  CROSS JOIN clock c
), member_groups AS (
  SELECT m."groupId" FROM public."Member" m
  JOIN active_groups g ON g.id = m."groupId"
  GROUP BY m."groupId" HAVING count(*) >= 2
), poi_groups AS (
  SELECT DISTINCT p."groupId" FROM public."PointOfInterest" p
  JOIN active_groups g ON g.id = p."groupId" CROSS JOIN clock c
  WHERE p."deletedAt" IS NULL AND
    (p.validity = 'PERMANENT' OR (p.validity <> 'PERMANENT' AND p."endTime" > c.now))
), event_groups AS (
  SELECT DISTINCT e."groupId" FROM public."Event" e
  JOIN active_groups g ON g.id = e."groupId" WHERE e."deletedAt" IS NULL
), group_counts AS (
  SELECT (SELECT count(*) FROM active_groups) AS active_groups,
    (SELECT count(*) FROM member_groups) AS groups_with_two_or_more_members,
    (SELECT count(*) FROM poi_groups) AS groups_with_poi,
    (SELECT count(*) FROM event_groups) AS groups_with_events
)
SELECT u.total_users, u.users_with_recent_location,
  COALESCE(100.0 * u.users_with_recent_location / NULLIF(u.users_sharing_location, 0), 0)
    AS users_with_recent_location_percent,
  u.weekly_active_users_foreground, g.active_groups, g.groups_with_two_or_more_members,
  g.groups_with_poi,
  COALESCE(100.0 * g.groups_with_poi / NULLIF(g.active_groups, 0), 0) AS groups_with_poi_percent,
  g.groups_with_events,
  COALESCE(100.0 * g.groups_with_events / NULLIF(g.active_groups, 0), 0) AS groups_with_events_percent,
  u.users_sharing_location
FROM user_counts u CROSS JOIN group_counts g;


COMMIT;
