"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
  BusinessModelManagementError,
  BUSINESS_MODEL_STATUSES,
  prepareBusinessModelInput,
} from "@/features/business-models/business-model-management";
import {
  BusinessModelStoreError,
  createPrismaBusinessModelStore,
} from "@/features/business-models/business-model-store";
import { requireCurrentUser } from "@/features/auth/current-user-server";
import type { Actor } from "@/lib/authz/types";
import { getDatabase } from "@/lib/db";

export type BusinessModelActionState =
  | { status: "idle" }
  | { status: "success"; message: string; recordId?: string }
  | { status: "error"; message: string };

const targetSchema = z.object({
  businessModelId: z.uuid(),
  revision: z.coerce.number().int().positive(),
});
const transitionSchema = targetSchema.extend({
  nextStatus: z.enum(BUSINESS_MODEL_STATUSES),
});

export async function createBusinessModelAction(
  _state: BusinessModelActionState,
  formData: FormData,
): Promise<BusinessModelActionState> {
  const actor = await currentActor();
  try {
    const input = prepareBusinessModelInput(actor, formInput(formData));
    const created = await createPrismaBusinessModelStore(getDatabase()).create(actor, input);
    revalidatePath("/business-models");
    return { status: "success", message: "商业模式已记录并生成首个审计版本。", recordId: created.id };
  } catch (error) {
    return actionError(error);
  }
}

export async function updateBusinessModelAction(
  _state: BusinessModelActionState,
  formData: FormData,
): Promise<BusinessModelActionState> {
  const actor = await currentActor();
  const target = targetSchema.safeParse({
    businessModelId: formData.get("businessModelId"),
    revision: formData.get("revision"),
  });
  if (!target.success) return invalidInput();
  try {
    const input = prepareBusinessModelInput(actor, formInput(formData));
    const updated = await createPrismaBusinessModelStore(getDatabase()).update(
      actor,
      target.data.businessModelId,
      target.data.revision,
      input,
    );
    revalidatePath("/business-models");
    revalidatePath(`/business-models/${updated.id}`);
    revalidatePath("/projects");
    revalidatePath("/conversations");
    return { status: "success", message: `已保存为版本 ${updated.revision}。`, recordId: updated.id };
  } catch (error) {
    return actionError(error);
  }
}

export async function transitionBusinessModelAction(
  _state: BusinessModelActionState,
  formData: FormData,
): Promise<BusinessModelActionState> {
  const actor = await currentActor();
  const parsed = transitionSchema.safeParse({
    businessModelId: formData.get("businessModelId"),
    revision: formData.get("revision"),
    nextStatus: formData.get("nextStatus"),
  });
  if (!parsed.success) return invalidInput();
  try {
    const updated = await createPrismaBusinessModelStore(getDatabase()).transition(
      actor,
      parsed.data.businessModelId,
      parsed.data.revision,
      parsed.data.nextStatus,
    );
    revalidatePath("/business-models");
    revalidatePath(`/business-models/${updated.id}`);
    const messages = {
      ACTIVE: "商业模式已恢复，可以继续编辑。",
      ARCHIVED: "商业模式已归档，原始内容已冻结。",
      DELETED: "商业模式已软删除，全部历史仍被保留。",
    } as const;
    return { status: "success", message: messages[updated.status], recordId: updated.id };
  } catch (error) {
    return actionError(error);
  }
}

function formInput(formData: FormData) {
  return {
    title: formData.get("title"),
    category: formData.get("category"),
    targetPlatform: formData.get("targetPlatform"),
    opportunity: formData.get("opportunity"),
    businessLogic: formData.get("businessLogic"),
    executionPlan: formData.get("executionPlan"),
    costAssumptions: formData.get("costAssumptions") ?? "",
    revenueAssumptions: formData.get("revenueAssumptions") ?? "",
    risks: formData.get("risks") ?? "",
    tags: splitLabels(formData.get("tags")),
    keywords: splitLabels(formData.get("keywords")),
  };
}

function splitLabels(value: FormDataEntryValue | null) {
  if (typeof value !== "string") return [];
  return value.split(/[,，]/).map((item) => item.trim()).filter(Boolean);
}

async function currentActor(): Promise<Actor> {
  const user = await requireCurrentUser();
  return { id: user.id, role: user.role, departmentId: user.department?.id ?? null };
}

function invalidInput(): BusinessModelActionState {
  return { status: "error", message: "提交内容无效，请刷新后重试。" };
}

function actionError(error: unknown): BusinessModelActionState {
  if (error instanceof BusinessModelManagementError) {
    const messages: Record<BusinessModelManagementError["code"], string> = {
      INVALID_BUSINESS_MODEL_INPUT: "请检查必填内容和输入长度。",
      BUSINESS_MODEL_OPERATION_FORBIDDEN: "只有最高管理员可以变更商业模式原文。",
      INVALID_BUSINESS_MODEL_TRANSITION: "当前状态不允许执行这项操作。",
    };
    return { status: "error", message: messages[error.code] };
  }
  if (error instanceof BusinessModelStoreError) {
    const messages: Record<BusinessModelStoreError["code"], string> = {
      BUSINESS_MODEL_NOT_FOUND: "商业模式不存在或已不可访问。",
      BUSINESS_MODEL_NOT_EDITABLE: "已归档的商业模式不能修改，请先恢复。",
      BUSINESS_MODEL_CONFLICT: "记录已被其他人更新，请刷新页面后重试。",
    };
    return { status: "error", message: messages[error.code] };
  }
  return { status: "error", message: "商业模式操作失败，请稍后重试。" };
}
