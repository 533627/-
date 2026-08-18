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
  "created_at",
  "updated_at"
)
SELECT
  '7709c484-3963-4443-b688-2a79c0545b60'::uuid,
  '2026.08.17-shanxi-xinxu-mkhf',
  'stable',
  '山系 / 新序 / 马克华菲完整程序包',
  '完整分享包：包含山系、新序、马克华菲模板逻辑、数据库、规则源与本地更新能力。保留本机 API 配置，不覆盖用户个人配置。',
  'FULL_SHARE'::"ReferenceStudioPackageKind",
  'https://github.com/533627/-/releases/download/reference-studio-20260817-165554/EcommerceReferenceStudio-share-shanxi-xinxu-mkhf-20260817-165554.zip',
  '97bb7557a0bc38736b5995a513e5979933446a341a038c02f1536370ee54a821',
  1419335295,
  ARRAY['shan_xi', 'xin_xu', 'ma_ke_hua_fei']::TEXT[],
  true,
  CURRENT_TIMESTAMP,
  COALESCE(
    (
      SELECT "id"
      FROM "user"
      WHERE "role" IN ('SUPER_ADMIN', 'OPERATIONS_ADMIN')
        AND "isActive" = true
      ORDER BY
        CASE "role"
          WHEN 'SUPER_ADMIN' THEN 0
          WHEN 'OPERATIONS_ADMIN' THEN 1
          ELSE 2
        END,
        "createdAt" ASC
      LIMIT 1
    ),
    (
      SELECT "id"
      FROM "user"
      ORDER BY "createdAt" ASC
      LIMIT 1
    )
  ),
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
WHERE EXISTS (SELECT 1 FROM "user")
ON CONFLICT ("channel", "version") DO UPDATE
SET
  "title" = EXCLUDED."title",
  "notes" = EXCLUDED."notes",
  "package_kind" = EXCLUDED."package_kind",
  "package_url" = EXCLUDED."package_url",
  "sha256" = EXCLUDED."sha256",
  "size_bytes" = EXCLUDED."size_bytes",
  "template_ids" = EXCLUDED."template_ids",
  "is_published" = true,
  "published_at" = COALESCE("reference_studio_releases"."published_at", CURRENT_TIMESTAMP),
  "updated_at" = CURRENT_TIMESTAMP;
