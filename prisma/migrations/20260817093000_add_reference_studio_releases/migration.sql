CREATE TYPE "ReferenceStudioPackageKind" AS ENUM ('FULL_SHARE', 'LOGIC_ONLY', 'TEMPLATE_DATA', 'RULES_ONLY');

CREATE TABLE "reference_studio_releases" (
    "id" UUID NOT NULL,
    "version" VARCHAR(80) NOT NULL,
    "channel" VARCHAR(50) NOT NULL DEFAULT 'stable',
    "title" VARCHAR(200) NOT NULL,
    "notes" TEXT NOT NULL DEFAULT '',
    "package_kind" "ReferenceStudioPackageKind" NOT NULL,
    "package_url" TEXT NOT NULL,
    "sha256" CHAR(64) NOT NULL,
    "size_bytes" BIGINT,
    "template_ids" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "is_published" BOOLEAN NOT NULL DEFAULT false,
    "published_at" TIMESTAMPTZ(3),
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "reference_studio_releases_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "reference_studio_releases_channel_version_key" ON "reference_studio_releases"("channel", "version");
CREATE INDEX "reference_studio_releases_channel_is_published_published_at_idx" ON "reference_studio_releases"("channel", "is_published", "published_at");
CREATE INDEX "reference_studio_releases_created_by_id_idx" ON "reference_studio_releases"("created_by_id");

ALTER TABLE "reference_studio_releases" ADD CONSTRAINT "reference_studio_releases_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
