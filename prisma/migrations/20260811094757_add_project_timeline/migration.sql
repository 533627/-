-- CreateEnum
CREATE TYPE "ProjectEventType" AS ENUM ('CREATED', 'STATUS_CHANGED', 'LEAD_CHANGED', 'MEMBER_ADDED', 'MEMBER_REMOVED', 'DEPARTMENT_ADDED', 'DEPARTMENT_REMOVED');

-- AlterTable
ALTER TABLE "projects" ADD COLUMN     "revision" INTEGER NOT NULL DEFAULT 1;

-- CreateTable
CREATE TABLE "project_events" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "actorId" TEXT NOT NULL,
    "type" "ProjectEventType" NOT NULL,
    "revision" INTEGER NOT NULL,
    "details" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "project_events_actorId_idx" ON "project_events"("actorId");

-- CreateIndex
CREATE INDEX "project_events_type_createdAt_idx" ON "project_events"("type", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "project_events_projectId_revision_key" ON "project_events"("projectId", "revision");

-- AddForeignKey
ALTER TABLE "project_events" ADD CONSTRAINT "project_events_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_events" ADD CONSTRAINT "project_events_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
