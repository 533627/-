CREATE TABLE "business_model_images" (
    "id" UUID NOT NULL,
    "businessModelId" UUID NOT NULL,
    "fileName" VARCHAR(180) NOT NULL,
    "mimeType" VARCHAR(50) NOT NULL,
    "size" INTEGER NOT NULL,
    "data" BYTEA NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "business_model_images_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "business_model_images_businessModelId_createdAt_idx"
ON "business_model_images"("businessModelId", "createdAt");

CREATE INDEX "business_model_images_uploadedById_idx"
ON "business_model_images"("uploadedById");

ALTER TABLE "business_model_images"
ADD CONSTRAINT "business_model_images_businessModelId_fkey"
FOREIGN KEY ("businessModelId") REFERENCES "business_models"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "business_model_images"
ADD CONSTRAINT "business_model_images_uploadedById_fkey"
FOREIGN KEY ("uploadedById") REFERENCES "user"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
