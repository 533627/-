"use server";

import { revalidatePath } from "next/cache";

import { requireCurrentUser } from "@/features/auth/current-user-server";
import {
  parseReferenceStudioReleaseForm,
} from "@/features/reference-studio-updates/release-contract";
import {
  ReferenceStudioReleaseError,
  createReferenceStudioRelease,
  setReferenceStudioReleasePublished,
} from "@/features/reference-studio-updates/release-store";
import type { Actor } from "@/lib/authz/types";

export type ReferenceStudioReleaseActionState =
  | { status: "idle" }
  | { status: "success"; message: string }
  | { status: "error"; message: string };

export async function createReferenceStudioReleaseAction(
  _previousState: ReferenceStudioReleaseActionState,
  formData: FormData,
): Promise<ReferenceStudioReleaseActionState> {
  const user = await requireCurrentUser();
  const actor = toActor(user);
  const parsed = parseReferenceStudioReleaseForm({
    version: formData.get("version"),
    channel: formData.get("channel"),
    title: formData.get("title"),
    notes: formData.get("notes"),
    packageKind: formData.get("packageKind"),
    packageUrl: formData.get("packageUrl"),
    sha256: formData.get("sha256"),
    sizeBytes: formData.get("sizeBytes"),
    templateIds: formData.get("templateIds"),
    publishNow: formData.get("publishNow"),
  });

  if (!parsed.success) {
    return { status: "error", message: parsed.message };
  }

  try {
    await createReferenceStudioRelease(actor, parsed.data);
    revalidatePath("/reference-studio-updates");
    return {
      status: "success",
      message: parsed.data.publishNow
        ? "更新版本已创建并发布，本地程序现在可以检测到。"
        : "更新版本已创建，发布后本地程序才会检测到。",
    };
  } catch (error) {
    return referenceStudioReleaseActionError(error);
  }
}

export async function setReferenceStudioReleasePublishedAction(
  _previousState: ReferenceStudioReleaseActionState,
  formData: FormData,
): Promise<ReferenceStudioReleaseActionState> {
  const user = await requireCurrentUser();
  const actor = toActor(user);
  const releaseId = formData.get("releaseId");
  const nextIsPublished = formData.get("nextIsPublished") === "true";

  if (typeof releaseId !== "string" || !releaseId) {
    return { status: "error", message: "更新版本 ID 无效。" };
  }

  try {
    await setReferenceStudioReleasePublished(actor, releaseId, nextIsPublished);
    revalidatePath("/reference-studio-updates");
    return {
      status: "success",
      message: nextIsPublished ? "已发布更新版本。" : "已取消发布更新版本。",
    };
  } catch (error) {
    return referenceStudioReleaseActionError(error);
  }
}

function toActor(user: Awaited<ReturnType<typeof requireCurrentUser>>): Actor {
  return {
    id: user.id,
    role: user.role,
    departmentId: user.department?.id ?? null,
    operationsTeam: user.operationsTeam,
  };
}

function referenceStudioReleaseActionError(
  error: unknown,
): ReferenceStudioReleaseActionState {
  if (error instanceof ReferenceStudioReleaseError) {
    const messages: Record<ReferenceStudioReleaseError["code"], string> = {
      REFERENCE_STUDIO_RELEASE_FORBIDDEN: "只有最高管理员或运营组长可以发布本地生图程序更新。",
      REFERENCE_STUDIO_RELEASE_NOT_FOUND: "更新版本不存在。",
      REFERENCE_STUDIO_RELEASE_DUPLICATE: "同一通道下已经存在这个版本号。",
      REFERENCE_STUDIO_RELEASE_STORE_FAILED: "更新版本保存失败，请检查数据库状态。",
    };
    return { status: "error", message: messages[error.code] };
  }

  return { status: "error", message: "更新版本操作失败，请稍后重试。" };
}
