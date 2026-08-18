import { z } from "zod";

export const REFERENCE_STUDIO_APP_ID = "ecommerce-reference-studio";
export const REFERENCE_STUDIO_CONTRACT_VERSION = 1;

export const REFERENCE_STUDIO_PACKAGE_KINDS = [
  "FULL_SHARE",
  "LOGIC_ONLY",
  "TEMPLATE_DATA",
  "RULES_ONLY",
] as const;

export type ReferenceStudioPackageKind =
  (typeof REFERENCE_STUDIO_PACKAGE_KINDS)[number];

export type ReferenceStudioReleaseInput = {
  version: string;
  channel: string;
  title: string;
  notes: string;
  packageKind: ReferenceStudioPackageKind;
  packageUrl: string;
  sha256: string;
  sizeBytes: bigint | null;
  templateIds: string[];
  publishNow: boolean;
};

export type ReferenceStudioReleaseRecord = Omit<
  ReferenceStudioReleaseInput,
  "publishNow"
> & {
  id: string;
  isPublished: boolean;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  createdById: string;
  createdByName: string | null;
};

export type ReferenceStudioLatestManifest = {
  appId: typeof REFERENCE_STUDIO_APP_ID;
  contractVersion: typeof REFERENCE_STUDIO_CONTRACT_VERSION;
  channel: string;
  latest: {
    id: string;
    version: string;
    title: string;
    notes: string;
    packageKind: ReferenceStudioPackageKind;
    packageUrl: string;
    sha256: string;
    sizeBytes: string | null;
    templateIds: string[];
    publishedAt: string;
  };
  installer: {
    preserveUserConfig: true;
    compatiblePackageKinds: readonly ReferenceStudioPackageKind[];
  };
};

const releaseFormSchema = z.object({
  version: z
    .string()
    .trim()
    .min(1, "版本号不能为空")
    .max(80, "版本号过长")
    .regex(/^[A-Za-z0-9._-]+$/, "版本号只能包含英文、数字、点、下划线和短横线"),
  channel: z
    .string()
    .trim()
    .min(1, "通道不能为空")
    .max(50, "通道名称过长")
    .regex(/^[a-z0-9._-]+$/, "通道只能包含小写英文、数字、点、下划线和短横线"),
  title: z.string().trim().min(1, "标题不能为空").max(200, "标题过长"),
  notes: z.string().trim().max(10_000, "说明过长"),
  packageKind: z.enum(REFERENCE_STUDIO_PACKAGE_KINDS),
  packageUrl: z.url("更新包地址不是有效 URL").max(2048, "更新包地址过长"),
  sha256: z
    .string()
    .trim()
    .regex(/^[a-fA-F0-9]{64}$/, "SHA256 必须是 64 位十六进制"),
  sizeBytes: z.string().trim(),
  templateIds: z.string().trim().max(1000, "模板 ID 内容过长"),
  publishNow: z.boolean(),
});

export function parseReferenceStudioReleaseForm(
  raw: Record<string, FormDataEntryValue | boolean | null>,
): { success: true; data: ReferenceStudioReleaseInput } | {
  success: false;
  message: string;
} {
  const parsed = releaseFormSchema.safeParse({
    version: asString(raw.version),
    channel: asString(raw.channel) || "stable",
    title: asString(raw.title),
    notes: asString(raw.notes),
    packageKind: asString(raw.packageKind),
    packageUrl: asString(raw.packageUrl),
    sha256: asString(raw.sha256),
    sizeBytes: asString(raw.sizeBytes),
    templateIds: asString(raw.templateIds),
    publishNow: raw.publishNow === true || asString(raw.publishNow) === "on",
  });

  if (!parsed.success) {
    return { success: false, message: parsed.error.issues[0]?.message ?? "发布内容无效" };
  }

  const sizeBytes = parseOptionalBigInt(parsed.data.sizeBytes);
  if (sizeBytes === undefined) {
    return { success: false, message: "文件大小必须是正整数，或留空" };
  }

  return {
    success: true,
    data: {
      ...parsed.data,
      sha256: parsed.data.sha256.toLowerCase(),
      sizeBytes,
      templateIds: parseTemplateIds(parsed.data.templateIds),
    },
  };
}

export function createLatestManifest(
  release: ReferenceStudioReleaseRecord,
): ReferenceStudioLatestManifest {
  if (!release.isPublished || !release.publishedAt) {
    throw new Error("Cannot create an update manifest from an unpublished release.");
  }

  return {
    appId: REFERENCE_STUDIO_APP_ID,
    contractVersion: REFERENCE_STUDIO_CONTRACT_VERSION,
    channel: release.channel,
    latest: {
      id: release.id,
      version: release.version,
      title: release.title,
      notes: release.notes,
      packageKind: release.packageKind,
      packageUrl: release.packageUrl,
      sha256: release.sha256,
      sizeBytes: release.sizeBytes?.toString() ?? null,
      templateIds: release.templateIds,
      publishedAt: release.publishedAt.toISOString(),
    },
    installer: {
      preserveUserConfig: true,
      compatiblePackageKinds: REFERENCE_STUDIO_PACKAGE_KINDS,
    },
  };
}

export function parseTemplateIds(value: string) {
  return [...new Set(
    value
      .split(/[\s,，;；]+/)
      .map((item) => item.trim())
      .filter(Boolean),
  )].slice(0, 20);
}

function parseOptionalBigInt(value: string) {
  if (!value) return null;
  if (!/^\d+$/.test(value)) return undefined;
  const parsed = BigInt(value);
  return parsed > BigInt(0) ? parsed : undefined;
}

function asString(value: FormDataEntryValue | boolean | null | undefined) {
  return typeof value === "string" ? value : "";
}
