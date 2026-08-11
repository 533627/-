"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
  AccountManagementError,
  prepareAccountCreation,
  preparePasswordReset,
} from "@/features/accounts/account-management";
import {
  AccountStoreError,
  createPrismaAccountStore,
} from "@/features/accounts/account-store";
import { requireCurrentUser } from "@/features/auth/current-user-server";
import { hasCapability } from "@/lib/authz/permissions";
import type { Actor } from "@/lib/authz/types";
import { getDatabase } from "@/lib/db";

export type AccountActionState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | {
      status: "success";
      message: string;
      credentials?: { username: string; password: string };
    };

const targetSchema = z.object({ targetId: z.uuid() });
const statusSchema = targetSchema.extend({
  nextIsActive: z.enum(["true", "false"]),
});

export async function createAccountAction(
  _previousState: AccountActionState,
  formData: FormData,
): Promise<AccountActionState> {
  const user = await requireCurrentUser();
  const actor = toActor(user);
  if (!hasCapability(actor.role, "ACCOUNT_MANAGE")) return forbidden();

  try {
    const prepared = await prepareAccountCreation(actor, {
      name: formData.get("name"),
      username: formData.get("username"),
      role: formData.get("role"),
      departmentId: optionalString(formData.get("departmentId")),
    });
    const created = await createPrismaAccountStore(getDatabase()).create(
      prepared.account,
    );

    revalidatePath("/accounts");
    return {
      status: "success",
      message: "账号已创建。请立即把密码交给员工。",
      credentials: { username: created.username!, password: prepared.password },
    };
  } catch (error) {
    return actionError(error);
  }
}

export async function resetAccountPasswordAction(
  _previousState: AccountActionState,
  formData: FormData,
): Promise<AccountActionState> {
  const user = await requireCurrentUser();
  const actor = toActor(user);
  if (!hasCapability(actor.role, "ACCOUNT_MANAGE")) return forbidden();

  const parsed = targetSchema.safeParse({ targetId: formData.get("targetId") });
  if (!parsed.success) return invalidInput();

  try {
    const target = await getDatabase().user.findUnique({
      where: { id: parsed.data.targetId },
      select: {
        id: true,
        username: true,
        role: true,
        isActive: true,
      },
    });
    if (!target?.username) throw new AccountStoreError("ACCOUNT_NOT_FOUND");

    const prepared = await preparePasswordReset(actor, target);
    await createPrismaAccountStore(getDatabase()).resetPassword(
      actor,
      target.id,
      prepared.passwordHash,
    );

    revalidatePath("/accounts");
    return {
      status: "success",
      message: "密码已重置，旧登录会话已全部退出。",
      credentials: { username: target.username, password: prepared.password },
    };
  } catch (error) {
    return actionError(error);
  }
}

export async function setAccountActiveAction(
  _previousState: AccountActionState,
  formData: FormData,
): Promise<AccountActionState> {
  const user = await requireCurrentUser();
  const actor = toActor(user);
  if (!hasCapability(actor.role, "ACCOUNT_MANAGE")) return forbidden();

  const parsed = statusSchema.safeParse({
    targetId: formData.get("targetId"),
    nextIsActive: formData.get("nextIsActive"),
  });
  if (!parsed.success) return invalidInput();

  try {
    const nextIsActive = parsed.data.nextIsActive === "true";
    await createPrismaAccountStore(getDatabase()).setActive(
      actor,
      parsed.data.targetId,
      nextIsActive,
    );
    revalidatePath("/accounts");
    return {
      status: "success",
      message: nextIsActive
        ? "账号已启用，可以重新登录。"
        : "账号已停用，旧登录会话已全部退出。",
    };
  } catch (error) {
    return actionError(error);
  }
}

function toActor(user: Awaited<ReturnType<typeof requireCurrentUser>>): Actor {
  return {
    id: user.id,
    role: user.role,
    departmentId: user.department?.id ?? null,
  };
}

function optionalString(value: FormDataEntryValue | null) {
  return typeof value === "string" && value ? value : null;
}

function forbidden(): AccountActionState {
  return { status: "error", message: "你没有权限执行这项账号操作。" };
}

function invalidInput(): AccountActionState {
  return { status: "error", message: "提交内容无效，请检查后重试。" };
}

function actionError(error: unknown): AccountActionState {
  if (error instanceof AccountManagementError) {
    const messages: Record<AccountManagementError["code"], string> = {
      INVALID_ACCOUNT_INPUT: "账号资料格式不正确，请检查后重试。",
      DEPARTMENT_REQUIRED: "该角色必须选择所属部门。",
      ACCOUNT_OPERATION_FORBIDDEN: "你没有权限操作这个账号。",
      INVALID_GENERATED_PASSWORD: "密码生成失败，请重新尝试。",
      SELF_DEACTIVATION: "不能停用当前正在使用的账号。",
    };
    return { status: "error", message: messages[error.code] };
  }

  if (error instanceof AccountStoreError) {
    const messages: Record<AccountStoreError["code"], string> = {
      USERNAME_ALREADY_EXISTS: "这个登录账号已经存在，请更换一个账号。",
      DEPARTMENT_UNAVAILABLE: "所选部门不存在或已停用。",
      ACCOUNT_NOT_FOUND: "账号不存在或你无权操作。",
    };
    return { status: "error", message: messages[error.code] };
  }

  return { status: "error", message: "账号操作失败，请稍后重试。" };
}
