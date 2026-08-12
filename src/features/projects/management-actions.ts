"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireCurrentUser } from "@/features/auth/current-user-server";
import { ProjectManagementError } from "@/features/projects/project-management";
import { createPrismaProjectStore } from "@/features/projects/project-store";
import type { Actor } from "@/lib/authz/types";
import { getDatabase } from "@/lib/db";

export type ProjectManagementActionState =
  | { status: "idle" }
  | { status: "success"; message: string }
  | { status: "error"; message: string };

const base = z.object({ projectId: z.uuid(), revision: z.coerce.number().int().positive() });
const mutationSchema = z.discriminatedUnion("operation", [
  base.extend({ operation: z.literal("STATUS"), status: z.enum(["PREPARING", "IN_PROGRESS", "PAUSED", "COMPLETED", "ARCHIVED"]) }),
  base.extend({ operation: z.literal("LEAD"), targetId: z.string().min(1) }),
  base.extend({ operation: z.literal("ADD_MEMBER"), targetId: z.string().min(1) }),
  base.extend({ operation: z.literal("REMOVE_MEMBER"), targetId: z.string().min(1) }),
  base.extend({ operation: z.literal("ADD_DEPARTMENT"), targetId: z.uuid() }),
  base.extend({ operation: z.literal("REMOVE_DEPARTMENT"), targetId: z.uuid() }),
]);

export async function manageProjectAction(
  _state: ProjectManagementActionState,
  formData: FormData,
): Promise<ProjectManagementActionState> {
  const user = await requireCurrentUser();
  const actor: Actor = { id: user.id, role: user.role, departmentId: user.department?.id ?? null };
  const parsed = mutationSchema.safeParse({
    operation: formData.get("operation"),
    projectId: formData.get("projectId"),
    revision: formData.get("revision"),
    targetId: formData.get("targetId"),
    status: formData.get("status"),
  });
  if (!parsed.success) return { status: "error", message: "提交内容无效，请刷新页面后重试。" };

  const store = createPrismaProjectStore(getDatabase());
  const mutation = parsed.data;
  try {
    switch (mutation.operation) {
      case "STATUS":
        await store.changeStatus(actor, mutation.projectId, mutation.status, mutation.revision);
        break;
      case "LEAD":
        await store.changeLead(actor, mutation.projectId, mutation.targetId, mutation.revision);
        break;
      case "ADD_MEMBER":
        await store.addMember(actor, mutation.projectId, mutation.targetId, mutation.revision);
        break;
      case "REMOVE_MEMBER":
        await store.removeMember(actor, mutation.projectId, mutation.targetId, mutation.revision);
        break;
      case "ADD_DEPARTMENT":
        await store.addDepartment(actor, mutation.projectId, mutation.targetId, mutation.revision);
        break;
      case "REMOVE_DEPARTMENT":
        await store.removeDepartment(actor, mutation.projectId, mutation.targetId, mutation.revision);
        break;
    }
    revalidatePath("/projects");
    revalidatePath(`/projects/${mutation.projectId}`);
    return { status: "success", message: successMessage(mutation.operation) };
  } catch (error) {
    if (error instanceof ProjectManagementError) {
      return { status: "error", message: errorMessage(error.code) };
    }
    return { status: "error", message: "操作失败，数据没有保留半成品，请稍后重试。" };
  }
}

function successMessage(operation: z.infer<typeof mutationSchema>["operation"]) {
  return {
    STATUS: "项目状态已更新并写入时间线。",
    LEAD: "项目负责人已完成交接。",
    ADD_MEMBER: "成员已加入项目并获得访问权。",
    REMOVE_MEMBER: "成员已移除，项目访问权已立即收回。",
    ADD_DEPARTMENT: "参与部门已加入项目。",
    REMOVE_DEPARTMENT: "参与部门已移出项目。",
  }[operation];
}

function errorMessage(code: ProjectManagementError["code"]) {
  return {
    PROJECT_MANAGE_FORBIDDEN: "只有最高管理员可以管理项目成员和部门。",
    PROJECT_VIEW_FORBIDDEN: "你已不在该项目中，无法继续操作。",
    PROJECT_NOT_FOUND: "项目不存在或已不可用。",
    PROJECT_CONFLICT: "项目刚刚被其他人更新，请刷新后重试。",
    PROJECT_STATUS_TRANSITION_INVALID: "当前项目状态不能切换到所选状态。",
    PROJECT_MEMBER_NOT_FOUND: "请选择仍在项目中的有效成员。",
    PROJECT_MEMBER_INACTIVE: "该账号已停用，不能加入项目。",
    PROJECT_LEAD_REMOVAL_FORBIDDEN: "请先交接项目负责人，再移除原负责人。",
    PROJECT_DEPARTMENT_NOT_FOUND: "该部门已不在项目中。",
    PROJECT_DEPARTMENT_INACTIVE: "该部门已停用，不能加入项目。",
    PROJECT_INPUT_INVALID: "项目资料不完整。",
    PROJECT_SOURCE_NOT_ACTIONABLE: "商业模式或负责人当前不可用。",
  }[code];
}
