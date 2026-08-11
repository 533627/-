-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('PENDING_ACCEPTANCE', 'ACCEPTED', 'IN_PROGRESS', 'PENDING_REVIEW', 'NEEDS_REVISION', 'COMPLETED');

-- CreateEnum
CREATE TYPE "TaskPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "TaskEventType" AS ENUM ('ASSIGNED', 'ACCEPTED', 'STARTED', 'SUBMITTED', 'REJECTED', 'APPROVED');

-- CreateTable
CREATE TABLE "tasks" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "priority" "TaskPriority" NOT NULL DEFAULT 'MEDIUM',
    "status" "TaskStatus" NOT NULL DEFAULT 'PENDING_ACCEPTANCE',
    "version" INTEGER NOT NULL DEFAULT 1,
    "assigneeId" TEXT NOT NULL,
    "assignedById" TEXT NOT NULL,
    "dueAt" TIMESTAMPTZ(3) NOT NULL,
    "submissionNote" TEXT,
    "rejectionReason" TEXT,
    "acceptedAt" TIMESTAMPTZ(3),
    "startedAt" TIMESTAMPTZ(3),
    "submittedAt" TIMESTAMPTZ(3),
    "completedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_events" (
    "id" UUID NOT NULL,
    "taskId" UUID NOT NULL,
    "actorId" TEXT NOT NULL,
    "type" "TaskEventType" NOT NULL,
    "version" INTEGER NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "tasks_assigneeId_status_dueAt_idx" ON "tasks"("assigneeId", "status", "dueAt");

-- CreateIndex
CREATE INDEX "tasks_assignedById_status_dueAt_idx" ON "tasks"("assignedById", "status", "dueAt");

-- CreateIndex
CREATE INDEX "tasks_projectId_status_dueAt_idx" ON "tasks"("projectId", "status", "dueAt");

-- CreateIndex
CREATE INDEX "task_events_actorId_idx" ON "task_events"("actorId");

-- CreateIndex
CREATE INDEX "task_events_type_createdAt_idx" ON "task_events"("type", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "task_events_taskId_version_key" ON "task_events"("taskId", "version");

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_events" ADD CONSTRAINT "task_events_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_events" ADD CONSTRAINT "task_events_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
