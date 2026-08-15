ALTER TABLE "tasks" ADD COLUMN "startsAt" TIMESTAMPTZ(3);

CREATE TABLE "task_subtasks" (
    "id" UUID NOT NULL,
    "taskId" UUID NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "position" INTEGER NOT NULL,
    "isCompleted" BOOLEAN NOT NULL DEFAULT false,
    "completedAt" TIMESTAMPTZ(3),
    "completedById" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "task_subtasks_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "task_subtasks_taskId_position_key" ON "task_subtasks"("taskId", "position");
CREATE INDEX "task_subtasks_taskId_isCompleted_idx" ON "task_subtasks"("taskId", "isCompleted");
CREATE INDEX "task_subtasks_completedById_idx" ON "task_subtasks"("completedById");

ALTER TABLE "task_subtasks" ADD CONSTRAINT "task_subtasks_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "task_subtasks" ADD CONSTRAINT "task_subtasks_completedById_fkey" FOREIGN KEY ("completedById") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
