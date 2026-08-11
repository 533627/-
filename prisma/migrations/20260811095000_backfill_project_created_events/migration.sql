-- Existing C3 projects predate the project timeline. Give each one the same
-- initial CREATED event that newly converted projects receive.
INSERT INTO "project_events" (
  "id",
  "projectId",
  "actorId",
  "type",
  "revision",
  "details",
  "createdAt"
)
SELECT
  gen_random_uuid(),
  "id",
  "createdById",
  'CREATED'::"ProjectEventType",
  1,
  jsonb_build_object('sourceRequestId', "sourceRequestId"),
  "createdAt"
FROM "projects"
ON CONFLICT ("projectId", "revision") DO NOTHING;
