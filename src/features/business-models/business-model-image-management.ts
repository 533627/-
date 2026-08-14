import { hasCapability } from "@/lib/authz/permissions";
import type { Actor } from "@/lib/authz/types";

export const BUSINESS_MODEL_IMAGE_MAX_BYTES = 3 * 1024 * 1024;
export const BUSINESS_MODEL_IMAGE_MAX_COUNT = 50;
export const BUSINESS_MODEL_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
] as const;

export type BusinessModelImageInput = {
  name: string;
  type: string;
  bytes: Uint8Array;
};

export class BusinessModelImageError extends Error {
  constructor(
    public readonly code:
      | "BUSINESS_MODEL_IMAGE_FORBIDDEN"
      | "BUSINESS_MODEL_IMAGE_INVALID_TYPE"
      | "BUSINESS_MODEL_IMAGE_TOO_LARGE"
      | "BUSINESS_MODEL_IMAGE_LIMIT_REACHED"
      | "BUSINESS_MODEL_IMAGE_NOT_FOUND",
  ) {
    super(code);
    this.name = "BusinessModelImageError";
  }
}

export function prepareBusinessModelImage(actor: Actor, input: BusinessModelImageInput) {
  assertCanManageBusinessModelImages(actor);
  if (input.bytes.byteLength > BUSINESS_MODEL_IMAGE_MAX_BYTES) {
    throw new BusinessModelImageError("BUSINESS_MODEL_IMAGE_TOO_LARGE");
  }
  if (input.bytes.byteLength === 0 || !isSupportedImage(input.type, input.bytes)) {
    throw new BusinessModelImageError("BUSINESS_MODEL_IMAGE_INVALID_TYPE");
  }
  const fileName = input.name
    .trim()
    .replace(/[\\/\u0000-\u001f\u007f]/g, "_")
    .slice(0, 180) || "未命名图片";
  return {
    fileName,
    mimeType: input.type as (typeof BUSINESS_MODEL_IMAGE_TYPES)[number],
    size: input.bytes.byteLength,
    data: input.bytes,
  };
}

export function assertCanManageBusinessModelImages(actor: Actor) {
  if (!hasCapability(actor.role, "BUSINESS_MODEL_MANAGE")) {
    throw new BusinessModelImageError("BUSINESS_MODEL_IMAGE_FORBIDDEN");
  }
}

function isSupportedImage(type: string, bytes: Uint8Array) {
  switch (type) {
    case "image/jpeg":
      return hasPrefix(bytes, [0xff, 0xd8, 0xff]);
    case "image/png":
      return hasPrefix(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    case "image/gif":
      return hasAsciiPrefix(bytes, "GIF87a") || hasAsciiPrefix(bytes, "GIF89a");
    case "image/webp":
      return hasAsciiPrefix(bytes, "RIFF") && hasAsciiPrefix(bytes.subarray(8), "WEBP");
    default:
      return false;
  }
}

function hasPrefix(bytes: Uint8Array, prefix: number[]) {
  return prefix.every((value, index) => bytes[index] === value);
}

function hasAsciiPrefix(bytes: Uint8Array, prefix: string) {
  return [...prefix].every((character, index) => bytes[index] === character.charCodeAt(0));
}
