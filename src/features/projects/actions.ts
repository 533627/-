"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireCurrentUser } from "@/features/auth/current-user-server";
import {
  createProjectDirectly,
  createProjectFromApprovedRequest,
  ProjectConversionError,
} from "@/features/projects/create-from-model";
import type { Actor } from "@/lib/authz/types";
import { getDatabase } from "@/lib/db";
import { ProjectManagementError } from "@/features/projects/project-management";

export type ProjectConversionActionState =
  | { status: "idle" }
  | { status: "success"; message: string; projectId: string }
  | { status: "error"; message: string };

const targetSchema = z.object({ requestId: z.uuid() });
const directTargetSchema = z.object({
  businessModelId: z.uuid(),
  leadId: z.string().min(1),
});

export async function createDirectProjectAction(
  _state: ProjectConversionActionState,
  formData: FormData,
): Promise<ProjectConversionActionState> {
  const user = await requireCurrentUser();
  const actor: Actor = { id: user.id, role: user.role, departmentId: user.department?.id ?? null };
  const target = directTargetSchema.safeParse({
    businessModelId: formData.get("businessModelId"),
    leadId: formData.get("leadId"),
  });
  if (!target.success) return { status: "error", message: "请选择项目负责人。" };
  try {
    const project = await createProjectDirectly(getDatabase(), actor, {
      ...target.data,
      name: String(formData.get("name") ?? ""),
      objective: String(formData.get("objective") ?? ""),
    });
    revalidatePath("/projects");
    revalidatePath("/conversations");
    return { status: "success", message: "项目与协作群已直接建立。", projectId: project.id };
  } catch (error) {
    if (error instanceof ProjectManagementError) {
      return {
        status: "error",
        message: error.code === "PROJECT_MANAGE_FORBIDDEN"
          ? "只有最高管理员可以直接立项。"
          : error.code === "PROJECT_INPUT_INVALID"
            ? "请填写至少 2 个字的项目名称。"
            : "商业模式或负责人当前不可用。",
      };
    }
    return { status: "error", message: "直接立项失败，请稍后重试。" };
  }
}

export async function convertProjectRequestAction(
  _state: ProjectConversionActionState,
  formData: FormData,
): Promise<ProjectConversionActionState> {
  const user = await requireCurrentUser();
  const actor: Actor = { id: user.id, role: user.role, departmentId: user.department?.id ?? null };
  const target = targetSchema.safeParse({ requestId: formData.get("requestId") });
  if (!target.success) return { status: "error", message: "立项申请标识无效，请刷新后重试。" };

  try {
    const result = await createProjectFromApprovedRequest(getDatabase(), actor, target.data.requestId);
    revalidatePath("/project-requests");
    revalidatePath("/projects");
    return {
      status: "success",
      projectId: result.project.id,
      message: result.created
        ? "正式项目、初始成员和项目协作群已同时创建。"
        : "这条申请已经生成过项目，没有重复创建。",
    };
  } catch (error) {
    if (error instanceof ProjectConversionError) {
      const messages: Record<ProjectConversionError["code"], string> = {
        PROJECT_CONVERSION_FORBIDDEN: "只有最高管理员可以创建正式项目。",
        PROJECT_REQUEST_NOT_APPROVED: "只有已批准的立项申请可以转换为项目。",
        PROJECT_CONVERSION_CONFLICT: "项目正在被其他操作创建，请稍后重试。",
      };
      return { status: "error", message: messages[error.code] };
    }
    return { status: "error", message: "项目创建失败，数据库没有保留半成品，请稍后重试。" };
  }
}
