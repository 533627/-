ALTER TABLE "projects" ALTER COLUMN "sourceRequestId" DROP NOT NULL;

CREATE TABLE "project_messages" (
    "id" UUID NOT NULL,
    "conversationId" UUID NOT NULL,
    "authorId" TEXT NOT NULL,
    "content" VARCHAR(2000) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "project_messages_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "department_messages" (
    "id" UUID NOT NULL,
    "departmentId" UUID NOT NULL,
    "authorId" TEXT NOT NULL,
    "content" VARCHAR(2000) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "department_messages_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "project_messages_conversationId_createdAt_idx" ON "project_messages"("conversationId", "createdAt");
CREATE INDEX "project_messages_authorId_idx" ON "project_messages"("authorId");
CREATE INDEX "department_messages_departmentId_createdAt_idx" ON "department_messages"("departmentId", "createdAt");
CREATE INDEX "department_messages_authorId_idx" ON "department_messages"("authorId");

ALTER TABLE "project_messages" ADD CONSTRAINT "project_messages_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "project_conversations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "project_messages" ADD CONSTRAINT "project_messages_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "department_messages" ADD CONSTRAINT "department_messages_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "department_messages" ADD CONSTRAINT "department_messages_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
