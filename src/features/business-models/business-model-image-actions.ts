"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireCurrentUser } from "@/features/auth/current-user-server";
import {
  BUSINESS_MODEL_IMAGE_MAX_BYTES,
  BusinessModelImageError,
  prepareBusinessModelImage,
} from "@/features/business-models/business-model-image-management";
import { createPrismaBusinessModelImageStore } from "@/features/business-models/business-model-image-store";
import type { Actor } from "@/lib/authz/types";
import { getDatabase } from "@/lib/db";

export type BusinessModelImageActionState =
  | { status: "idle" }
  | { status: "success"; message: string }
  | { status: "error"; message: string };

const idSchema = z.uuid();

export async function uploadBusinessModelImageAction(
  _state: BusinessModelImageActionState,
  formData: FormData,
): Promise<BusinessModelImageActionState> {
  const businessModelId = idSchema.safeParse(formData.get("businessModelId"));
  const file = formData.get("image");
  if (!businessModelId.success || !(file instanceof File) || !file.size) return invalidInput();
  if (file.size > BUSINESS_MODEL_IMAGE_MAX_BYTES) return imageError("BUSINESS_MODEL_IMAGE_TOO_LARGE");
  try {
    const actor = await currentActor();
    const image = prepareBusinessModelImage(actor, {
      name: file.name,
      type: file.type,
      bytes: new Uint8Array(await file.arrayBuffer()),
    });
    await createPrismaBusinessModelImageStore(getDatabase()).add(actor, businessModelId.data, image);
    revalidatePath(`/business-models/${businessModelId.data}`);
    return { status: "success", message: "图片已上传。" };
  } catch (error) {
    return actionError(error);
  }
}

export async function deleteBusinessModelImageAction(
  _state: BusinessModelImageActionState,
  formData: FormData,
): Promise<BusinessModelImageActionState> {
  const imageId = idSchema.safeParse(formData.get("imageId"));
  if (!imageId.success) return invalidInput();
  try {
    const actor = await currentActor();
    const removed = await createPrismaBusinessModelImageStore(getDatabase()).remove(actor, imageId.data);
    revalidatePath(`/business-models/${removed.businessModelId}`);
    return { status: "success", message: "图片已删除。" };
  } catch (error) {
    return actionError(error);
  }
}

async function currentActor(): Promise<Actor> {
  const user = await requireCurrentUser();
  return { id: user.id, role: user.role, departmentId: user.department?.id ?? null };
}

function invalidInput(): BusinessModelImageActionState {
  return { status: "error", message: "请选择有效图片后重试。" };
}

function imageError(code: BusinessModelImageError["code"]): BusinessModelImageActionState {
  const messages: Record<BusinessModelImageError["code"], string> = {
    BUSINESS_MODEL_IMAGE_FORBIDDEN: "你没有管理商业整理图片的权限。",
    BUSINESS_MODEL_IMAGE_INVALID_TYPE: "仅支持 JPG、PNG、WebP 和 GIF 图片。",
    BUSINESS_MODEL_IMAGE_TOO_LARGE: "单张图片不能超过 3MB。",
    BUSINESS_MODEL_IMAGE_LIMIT_REACHED: "每条商业整理最多保存 10 张图片。",
    BUSINESS_MODEL_IMAGE_NOT_FOUND: "商业整理或图片不存在。",
  };
  return { status: "error", message: messages[code] };
}

function actionError(error: unknown): BusinessModelImageActionState {
  return error instanceof BusinessModelImageError
    ? imageError(error.code)
    : { status: "error", message: "图片操作失败，请稍后重试。" };
}
