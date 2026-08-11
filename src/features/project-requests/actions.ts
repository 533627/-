"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireCurrentUser } from "@/features/auth/current-user-server";
import {
  PROJECT_REQUEST_DECISIONS,
  prepareExecutionSuggestionInput,
  prepareProjectRequestInput,
  ProjectRequestManagementError,
} from "@/features/project-requests/project-request-management";
import {
  createPrismaProjectRequestStore,
  ProjectRequestStoreError,
} from "@/features/project-requests/project-request-store";
import type { Actor } from "@/lib/authz/types";
import { getDatabase } from "@/lib/db";

export type ProjectRequestActionState =
  | { status: "idle" }
  | { status: "success"; message: string }
  | { status: "error"; message: string };

const suggestionTargetSchema = z.object({ businessModelId: z.uuid() });
const requestTargetSchema = z.object({ businessModelId: z.uuid(), suggestionId: z.uuid() });
const reviewTargetSchema = z.object({
  requestId: z.uuid(),
  businessModelId: z.uuid(),
  version: z.coerce.number().int().positive(),
  decision: z.enum(PROJECT_REQUEST_DECISIONS),
});

export async function createExecutionSuggestionAction(
  _state: ProjectRequestActionState,
  formData: FormData,
): Promise<ProjectRequestActionState> {
  const actor = await currentActor();
  const target = suggestionTargetSchema.safeParse({ businessModelId: formData.get("businessModelId") });
  if (!target.success) return invalidInput();
  try {
    const input = prepareExecutionSuggestionInput(actor, {
      businessModelId: target.data.businessModelId,
      content: formData.get("content"),
    });
    await createPrismaProjectRequestStore(getDatabase()).createSuggestion(actor, input);
    revalidateBusinessModel(target.data.businessModelId);
    return { status: "success", message: "执行建议已单独保存，原始商业内容没有被改动。" };
  } catch (error) {
    return actionError(error);
  }
}

export async function createProjectRequestAction(
  _state: ProjectRequestActionState,
  formData: FormData,
): Promise<ProjectRequestActionState> {
  const actor = await currentActor();
  const target = requestTargetSchema.safeParse({
    businessModelId: formData.get("businessModelId"),
    suggestionId: formData.get("suggestionId"),
  });
  if (!target.success) return invalidInput();
  try {
    const input = prepareProjectRequestInput(actor, {
      ...target.data,
      proposedName: formData.get("proposedName"),
      objective: formData.get("objective"),
    });
    await createPrismaProjectRequestStore(getDatabase()).createRequest(actor, input);
    revalidateBusinessModel(target.data.businessModelId);
    revalidatePath("/project-requests");
    return { status: "success", message: "立项申请已提交，等待最高管理员审批。" };
  } catch (error) {
    return actionError(error);
  }
}

export async function reviewProjectRequestAction(
  _state: ProjectRequestActionState,
  formData: FormData,
): Promise<ProjectRequestActionState> {
  const actor = await currentActor();
  const target = reviewTargetSchema.safeParse({
    requestId: formData.get("requestId"),
    businessModelId: formData.get("businessModelId"),
    version: formData.get("version"),
    decision: formData.get("decision"),
  });
  if (!target.success) return invalidInput();
  try {
    const reviewed = await createPrismaProjectRequestStore(getDatabase()).review(
      actor,
      target.data.requestId,
      target.data.version,
      target.data.decision,
      String(formData.get("rejectionReason") ?? ""),
    );
    revalidateBusinessModel(target.data.businessModelId);
    revalidatePath("/project-requests");
    return {
      status: "success",
      message: reviewed.status === "APPROVED" ? "立项申请已批准。" : "立项申请已拒绝，并已通知申请人。",
    };
  } catch (error) {
    return actionError(error);
  }
}

async function currentActor(): Promise<Actor> {
  const user = await requireCurrentUser();
  return { id: user.id, role: user.role, departmentId: user.department?.id ?? null };
}

function revalidateBusinessModel(businessModelId: string) {
  revalidatePath("/business-models");
  revalidatePath(`/business-models/${businessModelId}`);
}

function invalidInput(): ProjectRequestActionState {
  return { status: "error", message: "提交内容无效，请检查后重试。" };
}

function actionError(error: unknown): ProjectRequestActionState {
  if (error instanceof ProjectRequestManagementError) {
    const messages: Record<ProjectRequestManagementError["code"], string> = {
      INVALID_EXECUTION_SUGGESTION: "执行建议至少 2 个字，且不能超过 10000 字。",
      EXECUTION_SUGGESTION_FORBIDDEN: "当前账号不能添加执行建议。",
      INVALID_PROJECT_REQUEST: "请完整填写项目名称、目标并选择一条执行建议。",
      PROJECT_REQUEST_CREATE_FORBIDDEN: "当前账号不能提交立项申请。",
      PROJECT_REQUEST_REVIEW_FORBIDDEN: "只有最高管理员可以审批立项申请。",
      PROJECT_REQUEST_REJECTION_REASON_REQUIRED: "拒绝申请必须填写 2 至 2000 字的原因。",
      PROJECT_REQUEST_ALREADY_REVIEWED: "这条申请已经审批，不能重复处理。",
    };
    return { status: "error", message: messages[error.code] };
  }
  if (error instanceof ProjectRequestStoreError) {
    const messages: Record<ProjectRequestStoreError["code"], string> = {
      BUSINESS_MODEL_NOT_ACTIONABLE: "商业模式不存在、已归档或已删除，不能继续申请。",
      EXECUTION_SUGGESTION_NOT_FOUND: "执行建议不存在、不是你创建的，或与当前商业模式不匹配。",
      PROJECT_REQUEST_ALREADY_EXISTS: "这条执行建议已经提交过立项申请。",
      PROJECT_REQUEST_NOT_FOUND: "立项申请不存在或已不可访问。",
      PROJECT_REQUEST_ALREADY_REVIEWED: "这条申请已经审批，不能重复处理。",
      PROJECT_REQUEST_CONFLICT: "申请已被其他人更新，请刷新后重试。",
      PROJECT_REQUEST_VIEW_FORBIDDEN: "当前账号不能查看立项申请。",
    };
    return { status: "error", message: messages[error.code] };
  }
  return { status: "error", message: "操作失败，请稍后重试。" };
}
