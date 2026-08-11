-- CreateEnum
CREATE TYPE "BusinessModelStatus" AS ENUM ('ACTIVE', 'ARCHIVED', 'DELETED');

-- CreateEnum
CREATE TYPE "BusinessModelEventType" AS ENUM ('CREATED', 'UPDATED', 'ARCHIVED', 'RESTORED', 'DELETED');

-- CreateTable
CREATE TABLE "business_models" (
    "id" UUID NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "category" VARCHAR(100) NOT NULL,
    "targetPlatform" VARCHAR(100) NOT NULL,
    "opportunity" TEXT NOT NULL,
    "businessLogic" TEXT NOT NULL,
    "executionPlan" TEXT NOT NULL,
    "costAssumptions" TEXT NOT NULL DEFAULT '',
    "revenueAssumptions" TEXT NOT NULL DEFAULT '',
    "risks" TEXT NOT NULL DEFAULT '',
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "keywords" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" "BusinessModelStatus" NOT NULL DEFAULT 'ACTIVE',
    "revision" INTEGER NOT NULL DEFAULT 1,
    "archivedAt" TIMESTAMPTZ(3),
    "deletedAt" TIMESTAMPTZ(3),
    "createdById" TEXT NOT NULL,
    "updatedById" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "business_models_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "business_model_events" (
    "id" UUID NOT NULL,
    "businessModelId" UUID NOT NULL,
    "actorId" TEXT NOT NULL,
    "type" "BusinessModelEventType" NOT NULL,
    "revision" INTEGER NOT NULL,
    "snapshot" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "business_model_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "business_models_status_updatedAt_idx" ON "business_models"("status", "updatedAt");

-- CreateIndex
CREATE INDEX "business_models_category_idx" ON "business_models"("category");

-- CreateIndex
CREATE INDEX "business_models_targetPlatform_idx" ON "business_models"("targetPlatform");

-- CreateIndex
CREATE INDEX "business_models_tags_idx" ON "business_models" USING GIN ("tags");

-- CreateIndex
CREATE INDEX "business_models_keywords_idx" ON "business_models" USING GIN ("keywords");

-- CreateIndex
CREATE INDEX "business_models_createdById_idx" ON "business_models"("createdById");

-- CreateIndex
CREATE INDEX "business_model_events_actorId_idx" ON "business_model_events"("actorId");

-- CreateIndex
CREATE INDEX "business_model_events_type_createdAt_idx" ON "business_model_events"("type", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "business_model_events_businessModelId_revision_key" ON "business_model_events"("businessModelId", "revision");

-- AddForeignKey
ALTER TABLE "business_models" ADD CONSTRAINT "business_models_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_models" ADD CONSTRAINT "business_models_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_model_events" ADD CONSTRAINT "business_model_events_businessModelId_fkey" FOREIGN KEY ("businessModelId") REFERENCES "business_models"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_model_events" ADD CONSTRAINT "business_model_events_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
