import { describe, expect, it } from "vitest";

import {
  createLatestManifest,
  parseReferenceStudioReleaseForm,
  parseTemplateIds,
  type ReferenceStudioReleaseRecord,
} from "@/features/reference-studio-updates/release-contract";

describe("reference studio release contract", () => {
  it("normalizes release form data before it reaches the database", () => {
    const parsed = parseReferenceStudioReleaseForm({
      version: " 2026.08.17-test ",
      channel: "",
      title: " 山系新序马克华菲更新 ",
      notes: " 规则源同步 ",
      packageKind: "FULL_SHARE",
      packageUrl: "https://example.com/package.zip",
      sha256: "A".repeat(64),
      sizeBytes: "1320000000",
      templateIds: "shan_xi, xin_xu\nma_ke_hua_fei shan_xi",
      publishNow: "on",
    });

    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.channel).toBe("stable");
    expect(parsed.data.sha256).toBe("a".repeat(64));
    expect(parsed.data.sizeBytes).toBe(BigInt("1320000000"));
    expect(parsed.data.templateIds).toEqual([
      "shan_xi",
      "xin_xu",
      "ma_ke_hua_fei",
    ]);
    expect(parsed.data.publishNow).toBe(true);
  });

  it("rejects unsafe update package metadata", () => {
    const parsed = parseReferenceStudioReleaseForm({
      version: "bad version",
      channel: "stable",
      title: "bad",
      notes: "",
      packageKind: "FULL_SHARE",
      packageUrl: "not-url",
      sha256: "abc",
      sizeBytes: "-1",
      templateIds: "",
      publishNow: "",
    });

    expect(parsed.success).toBe(false);
  });

  it("creates the public manifest without leaking admin-only fields", () => {
    const release: ReferenceStudioReleaseRecord = {
      id: "6c0b7286-29ac-487a-9a64-126d27b69fb3",
      version: "2026.08.17-test",
      channel: "stable",
      title: "逻辑更新",
      notes: "只更新规则",
      packageKind: "LOGIC_ONLY",
      packageUrl: "https://example.com/update.zip",
      sha256: "b".repeat(64),
      sizeBytes: BigInt(1024),
      templateIds: ["shan_xi"],
      isPublished: true,
      publishedAt: new Date("2026-08-17T01:00:00.000Z"),
      createdAt: new Date("2026-08-17T00:00:00.000Z"),
      updatedAt: new Date("2026-08-17T00:00:00.000Z"),
      createdById: "admin",
      createdByName: "Admin",
    };

    expect(createLatestManifest(release)).toEqual({
      appId: "ecommerce-reference-studio",
      contractVersion: 1,
      channel: "stable",
      latest: {
        id: release.id,
        version: release.version,
        title: release.title,
        notes: release.notes,
        packageKind: "LOGIC_ONLY",
        packageUrl: release.packageUrl,
        sha256: release.sha256,
        sizeBytes: "1024",
        templateIds: ["shan_xi"],
        publishedAt: "2026-08-17T01:00:00.000Z",
      },
      installer: {
        preserveUserConfig: true,
        compatiblePackageKinds: [
          "FULL_SHARE",
          "LOGIC_ONLY",
          "TEMPLATE_DATA",
          "RULES_ONLY",
        ],
      },
    });
  });

  it("deduplicates template ids while preserving order", () => {
    expect(parseTemplateIds("a,b a\nc，b")).toEqual(["a", "b", "c"]);
  });
});
