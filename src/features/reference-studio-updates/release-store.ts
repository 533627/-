import { randomUUID } from "node:crypto";

import { hasCapability } from "@/lib/authz/permissions";
import type { Actor } from "@/lib/authz/types";
import { getDatabase } from "@/lib/db";
import type {
  ReferenceStudioPackageKind,
  ReferenceStudioReleaseInput,
  ReferenceStudioReleaseRecord,
} from "@/features/reference-studio-updates/release-contract";

export class ReferenceStudioReleaseError extends Error {
  constructor(
    readonly code:
      | "REFERENCE_STUDIO_RELEASE_FORBIDDEN"
      | "REFERENCE_STUDIO_RELEASE_NOT_FOUND"
      | "REFERENCE_STUDIO_RELEASE_DUPLICATE"
      | "REFERENCE_STUDIO_RELEASE_STORE_FAILED",
  ) {
    super(code);
  }
}

type ReferenceStudioReleaseRow = {
  id: string;
  version: string;
  channel: string;
  title: string;
  notes: string;
  package_kind: ReferenceStudioPackageKind;
  package_url: string;
  sha256: string;
  size_bytes: bigint | number | string | null;
  template_ids: string[];
  is_published: boolean;
  published_at: Date | null;
  created_at: Date;
  updated_at: Date;
  created_by_id: string;
  created_by_name: string | null;
};

export async function listReferenceStudioReleases(actor: Actor) {
  assertCanManage(actor);

  const rows = await getDatabase().$queryRaw<ReferenceStudioReleaseRow[]>`
    SELECT
      r."id",
      r."version",
      r."channel",
      r."title",
      r."notes",
      r."package_kind",
      r."package_url",
      r."sha256",
      r."size_bytes",
      r."template_ids",
      r."is_published",
      r."published_at",
      r."created_at",
      r."updated_at",
      r."created_by_id",
      u."name" AS "created_by_name"
    FROM "reference_studio_releases" r
    LEFT JOIN "user" u ON u."id" = r."created_by_id"
    ORDER BY r."created_at" DESC
    LIMIT 50
  `;

  return rows.map(toReleaseRecord);
}

export async function getLatestReferenceStudioRelease(channel = "stable") {
  const rows = await getDatabase().$queryRaw<ReferenceStudioReleaseRow[]>`
    SELECT
      r."id",
      r."version",
      r."channel",
      r."title",
      r."notes",
      r."package_kind",
      r."package_url",
      r."sha256",
      r."size_bytes",
      r."template_ids",
      r."is_published",
      r."published_at",
      r."created_at",
      r."updated_at",
      r."created_by_id",
      u."name" AS "created_by_name"
    FROM "reference_studio_releases" r
    LEFT JOIN "user" u ON u."id" = r."created_by_id"
    WHERE r."channel" = ${channel}
      AND r."is_published" = true
      AND r."published_at" IS NOT NULL
    ORDER BY r."published_at" DESC, r."created_at" DESC
    LIMIT 1
  `;

  return rows[0] ? toReleaseRecord(rows[0]) : null;
}

export async function createReferenceStudioRelease(
  actor: Actor,
  input: ReferenceStudioReleaseInput,
) {
  assertCanManage(actor);

  try {
    const rows = await getDatabase().$queryRaw<ReferenceStudioReleaseRow[]>`
      INSERT INTO "reference_studio_releases" (
        "id",
        "version",
        "channel",
        "title",
        "notes",
        "package_kind",
        "package_url",
        "sha256",
        "size_bytes",
        "template_ids",
        "is_published",
        "published_at",
        "created_by_id",
        "updated_at"
      )
      VALUES (
        ${randomUUID()}::uuid,
        ${input.version},
        ${input.channel},
        ${input.title},
        ${input.notes},
        CAST(${input.packageKind} AS "ReferenceStudioPackageKind"),
        ${input.packageUrl},
        ${input.sha256},
        ${input.sizeBytes},
        ${input.templateIds}::text[],
        ${input.publishNow},
        ${input.publishNow ? new Date() : null},
        ${actor.id},
        CURRENT_TIMESTAMP
      )
      RETURNING
        "id",
        "version",
        "channel",
        "title",
        "notes",
        "package_kind",
        "package_url",
        "sha256",
        "size_bytes",
        "template_ids",
        "is_published",
        "published_at",
        "created_at",
        "updated_at",
        "created_by_id",
        NULL::text AS "created_by_name"
    `;

    return toReleaseRecord(rows[0]!);
  } catch (error) {
    if (error instanceof Error && error.message.includes("unique")) {
      throw new ReferenceStudioReleaseError("REFERENCE_STUDIO_RELEASE_DUPLICATE");
    }
    throw new ReferenceStudioReleaseError("REFERENCE_STUDIO_RELEASE_STORE_FAILED");
  }
}

export async function setReferenceStudioReleasePublished(
  actor: Actor,
  releaseId: string,
  isPublished: boolean,
) {
  assertCanManage(actor);

  const rows = await getDatabase().$queryRaw<ReferenceStudioReleaseRow[]>`
    UPDATE "reference_studio_releases"
    SET
      "is_published" = ${isPublished},
      "published_at" = CASE WHEN ${isPublished} THEN COALESCE("published_at", CURRENT_TIMESTAMP) ELSE NULL END,
      "updated_at" = CURRENT_TIMESTAMP
    WHERE "id" = ${releaseId}::uuid
    RETURNING
      "id",
      "version",
      "channel",
      "title",
      "notes",
      "package_kind",
      "package_url",
      "sha256",
      "size_bytes",
      "template_ids",
      "is_published",
      "published_at",
      "created_at",
      "updated_at",
      "created_by_id",
      NULL::text AS "created_by_name"
  `;

  if (!rows[0]) {
    throw new ReferenceStudioReleaseError("REFERENCE_STUDIO_RELEASE_NOT_FOUND");
  }

  return toReleaseRecord(rows[0]);
}

function assertCanManage(actor: Actor) {
  if (!hasCapability(actor.role, "REFERENCE_STUDIO_UPDATE_MANAGE")) {
    throw new ReferenceStudioReleaseError("REFERENCE_STUDIO_RELEASE_FORBIDDEN");
  }
}

function toReleaseRecord(row: ReferenceStudioReleaseRow): ReferenceStudioReleaseRecord {
  return {
    id: row.id,
    version: row.version,
    channel: row.channel,
    title: row.title,
    notes: row.notes,
    packageKind: row.package_kind,
    packageUrl: row.package_url,
    sha256: row.sha256,
    sizeBytes:
      row.size_bytes === null ? null : BigInt(row.size_bytes.toString()),
    templateIds: row.template_ids ?? [],
    isPublished: row.is_published,
    publishedAt: row.published_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    createdById: row.created_by_id,
    createdByName: row.created_by_name,
  };
}
