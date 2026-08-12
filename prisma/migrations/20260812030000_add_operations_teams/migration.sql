CREATE TYPE "OperationsTeam" AS ENUM ('TEAM_ONE', 'TEAM_TWO');

ALTER TABLE "user" ADD COLUMN "operationsTeam" "OperationsTeam";
ALTER TABLE "department_messages" ADD COLUMN "operationsTeam" "OperationsTeam";
ALTER TABLE "department_membership_history"
  ADD COLUMN "fromOperationsTeam" "OperationsTeam",
  ADD COLUMN "toOperationsTeam" "OperationsTeam";

UPDATE "user"
SET "operationsTeam" = 'TEAM_ONE'
WHERE "departmentId" IN (SELECT "id" FROM "departments" WHERE "code" = 'OPERATIONS');

UPDATE "department_messages"
SET "operationsTeam" = 'TEAM_ONE'
WHERE "departmentId" IN (SELECT "id" FROM "departments" WHERE "code" = 'OPERATIONS');

DROP INDEX "department_messages_departmentId_createdAt_idx";
CREATE INDEX "department_messages_departmentId_operationsTeam_createdAt_idx"
ON "department_messages"("departmentId", "operationsTeam", "createdAt");
