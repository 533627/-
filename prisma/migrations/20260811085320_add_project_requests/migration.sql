-- CreateEnum
CREATE TYPE "ProjectRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ProjectRequestEventType" AS ENUM ('SUBMITTED', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('PROJECT_REQUEST_APPROVED', 'PROJECT_REQUEST_REJECTED');

-- CreateTable
CREATE TABLE "execution_suggestions" (
    "id" UUID NOT NULL,
    "businessModelId" UUID NOT NULL,
    "authorId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "execution_suggestions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_requests" (
    "id" UUID NOT NULL,
    "businessModelId" UUID NOT NULL,
    "suggestionId" UUID NOT NULL,
    "proposedName" VARCHAR(200) NOT NULL,
    "objective" TEXT NOT NULL,
    "status" "ProjectRequestStatus" NOT NULL DEFAULT 'PENDING',
    "version" INTEGER NOT NULL DEFAULT 1,
    "requestedById" TEXT NOT NULL,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMPTZ(3),
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "project_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_request_events" (
    "id" UUID NOT NULL,
    "requestId" UUID NOT NULL,
    "actorId" TEXT NOT NULL,
    "type" "ProjectRequestEventType" NOT NULL,
    "version" INTEGER NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_request_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "recipientId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "message" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readAt" TIMESTAMPTZ(3),

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "execution_suggestions_businessModelId_createdAt_idx" ON "execution_suggestions"("businessModelId", "createdAt");

-- CreateIndex
CREATE INDEX "execution_suggestions_authorId_idx" ON "execution_suggestions"("authorId");

-- CreateIndex
CREATE UNIQUE INDEX "project_requests_suggestionId_key" ON "project_requests"("suggestionId");

-- CreateIndex
CREATE INDEX "project_requests_businessModelId_status_createdAt_idx" ON "project_requests"("businessModelId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "project_requests_requestedById_status_createdAt_idx" ON "project_requests"("requestedById", "status", "createdAt");

-- CreateIndex
CREATE INDEX "project_requests_reviewedById_idx" ON "project_requests"("reviewedById");

-- CreateIndex
CREATE INDEX "project_request_events_actorId_idx" ON "project_request_events"("actorId");

-- CreateIndex
CREATE INDEX "project_request_events_type_createdAt_idx" ON "project_request_events"("type", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "project_request_events_requestId_version_key" ON "project_request_events"("requestId", "version");

-- CreateIndex
CREATE INDEX "notifications_recipientId_isRead_createdAt_idx" ON "notifications"("recipientId", "isRead", "createdAt");

-- CreateIndex
CREATE INDEX "notifications_resourceId_idx" ON "notifications"("resourceId");

-- AddForeignKey
ALTER TABLE "execution_suggestions" ADD CONSTRAINT "execution_suggestions_businessModelId_fkey" FOREIGN KEY ("businessModelId") REFERENCES "business_models"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "execution_suggestions" ADD CONSTRAINT "execution_suggestions_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_requests" ADD CONSTRAINT "project_requests_businessModelId_fkey" FOREIGN KEY ("businessModelId") REFERENCES "business_models"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_requests" ADD CONSTRAINT "project_requests_suggestionId_fkey" FOREIGN KEY ("suggestionId") REFERENCES "execution_suggestions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_requests" ADD CONSTRAINT "project_requests_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_requests" ADD CONSTRAINT "project_requests_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_request_events" ADD CONSTRAINT "project_request_events_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "project_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_request_events" ADD CONSTRAINT "project_request_events_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
