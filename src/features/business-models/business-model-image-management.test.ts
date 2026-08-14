import { describe, expect, it } from "vitest";

import {
  prepareBusinessModelImage,
  type BusinessModelImageInput,
} from "@/features/business-models/business-model-image-management";

const owner = { id: "owner", role: "SUPER_ADMIN", departmentId: null } as const;
const operationsAdmin = {
  id: "ops-lead",
  role: "OPERATIONS_ADMIN",
  departmentId: "00000000-0000-4000-8000-000000000001",
} as const;

describe("prepareBusinessModelImage", () => {
  it("accepts a small PNG and normalizes its stored metadata", () => {
    const input: BusinessModelImageInput = {
      name: "  商品主图.png  ",
      type: "image/png",
      bytes: Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]),
    };

    expect(prepareBusinessModelImage(owner, input)).toEqual({
      fileName: "商品主图.png",
      mimeType: "image/png",
      size: 9,
      data: input.bytes,
    });
  });

  it("rejects files whose content does not match the claimed image type", () => {
    expect(() => prepareBusinessModelImage(owner, {
      name: "伪装图片.png",
      type: "image/png",
      bytes: Uint8Array.from([0x3c, 0x73, 0x63, 0x72, 0x69, 0x70, 0x74]),
    })).toThrowError(expect.objectContaining({ code: "BUSINESS_MODEL_IMAGE_INVALID_TYPE" }));
  });

  it("rejects oversized files", () => {
    expect(() => prepareBusinessModelImage(owner, {
      name: "超大图片.jpg",
      type: "image/jpeg",
      bytes: new Uint8Array(3 * 1024 * 1024 + 1),
    })).toThrowError(expect.objectContaining({ code: "BUSINESS_MODEL_IMAGE_TOO_LARGE" }));
  });

  it("keeps read-only roles from uploading images", () => {
    expect(() => prepareBusinessModelImage(operationsAdmin, {
      name: "商品图.png",
      type: "image/png",
      bytes: Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    })).toThrowError(expect.objectContaining({ code: "BUSINESS_MODEL_IMAGE_FORBIDDEN" }));
  });
});
