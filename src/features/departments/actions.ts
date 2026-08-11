"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
  DepartmentManagementError,
  prepareDepartmentCreation,
} from "@/features/departments/department-management";
import {
  createPrismaDepartmentStore,
  DepartmentStoreError,
} from "@/features/departments/department-store";
import { requireCurrentUser } from "@/features/auth/current-user-server";
import type { Actor } from "@/lib/authz/types";
import { getDatabase } from "@/lib/db";

export type DepartmentActionState =
  | { status: "idle" }
  | { status: "success"; message: string }
  | { status: "error"; message: string };

const statusSchema = z.object({
  departmentId: z.uuid(),
  nextIsActive: z.enum(["true", "false"]),
});
const transferSchema = z.object({ memberId: z.string().min(1), departmentId: z.uuid() });

export async function createDepartmentAction(
  _state: DepartmentActionState,
  formData: FormData,
): Promise<DepartmentActionState> {
  const actor = await currentActor();
  try {
    const input = prepareDepartmentCreation(actor, {
      code: formData.get("code"),
      name: formData.get("name"),
    });
    await createPrismaDepartmentStore(getDatabase()).create(actor, input);
    revalidatePath("/departments");
    return { status: "success", message: "部门已创建，可以开始添加成员。" };
  } catch (error) {
    return actionError(error);
  }
}

export async function setDepartmentActiveAction(
  _state: DepartmentActionState,
  formData: FormData,
): Promise<DepartmentActionState> {
  const actor = await currentActor();
  const parsed = statusSchema.safeParse({
    departmentId: formData.get("departmentId"),
    nextIsActive: formData.get("nextIsActive"),
  });
  if (!parsed.success) return invalidInput();
  try {
    const nextIsActive = parsed.data.nextIsActive === "true";
    await createPrismaDepartmentStore(getDatabase()).setActive(
      actor,
      parsed.data.departmentId,
      nextIsActive,
    );
    revalidatePath("/departments");
    return {
      status: "success",
      message: nextIsActive ? "部门已启用。" : "部门已停用，历史数据仍会保留。",
    };
  } catch (error) {
    return actionError(error);
  }
}

export async function transferDepartmentMemberAction(
  _state: DepartmentActionState,
  formData: FormData,
): Promise<DepartmentActionState> {
  const actor = await currentActor();
  const parsed = transferSchema.safeParse({
    memberId: formData.get("memberId"),
    departmentId: formData.get("departmentId"),
  });
  if (!parsed.success) return invalidInput();
  try {
    await createPrismaDepartmentStore(getDatabase()).transferMember(
      actor,
      parsed.data.memberId,
      parsed.data.departmentId,
    );
    revalidatePath("/departments");
    revalidatePath("/accounts");
    return { status: "success", message: "员工已调动，部门群访问范围已同步更新。" };
  } catch (error) {
    return actionError(error);
  }
}

async function currentActor(): Promise<Actor> {
  const user = await requireCurrentUser();
  return { id: user.id, role: user.role, departmentId: user.department?.id ?? null };
}

function invalidInput(): DepartmentActionState {
  return { status: "error", message: "提交内容无效，请检查后重试。" };
}

function actionError(error: unknown): DepartmentActionState {
  if (error instanceof DepartmentManagementError) {
    const messages: Record<DepartmentManagementError["code"], string> = {
      INVALID_DEPARTMENT_INPUT: "部门名称或编码格式不正确。",
      DEPARTMENT_OPERATION_FORBIDDEN: "你没有权限维护部门结构。",
      MEMBER_OPERATION_FORBIDDEN: "你没有权限调动这名员工。",
      MEMBER_ALREADY_IN_DEPARTMENT: "该员工已经属于目标部门。",
    };
    return { status: "error", message: messages[error.code] };
  }
  if (error instanceof DepartmentStoreError) {
    const messages: Record<DepartmentStoreError["code"], string> = {
      DEPARTMENT_ALREADY_EXISTS: "部门名称或编码已经存在。",
      DEPARTMENT_NOT_FOUND: "部门不存在。",
      DEPARTMENT_HAS_ACTIVE_MEMBERS: "请先调离或停用该部门的所有在职成员。",
      DESTINATION_UNAVAILABLE: "目标部门不存在或已停用。",
      MEMBER_NOT_FOUND: "员工不存在。",
    };
    return { status: "error", message: messages[error.code] };
  }
  return { status: "error", message: "部门操作失败，请稍后重试。" };
}
