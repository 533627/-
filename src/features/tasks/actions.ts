"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireCurrentUser } from "@/features/auth/current-user-server";
import { TaskWorkflowError } from "@/features/tasks/task-state-machine";
import { createPrismaTaskStore, TaskStoreError } from "@/features/tasks/task-store";
import type { Actor } from "@/lib/authz/types";
import { getDatabase } from "@/lib/db";

export type TaskActionState =
  | { status: "idle" }
  | { status: "success"; message: string }
  | { status: "error"; message: string };

const createSchema = z.object({
  projectId: z.union([z.uuid(), z.literal("")]).transform((value) => value || null),
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(4000),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]),
  assigneeId: z.string().min(1),
  dueAt: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/),
});

const transitionSchema = z.object({
  taskId: z.uuid(),
  projectId: z.union([z.uuid(), z.literal("")]).transform((value) => value || null),
  version: z.coerce.number().int().positive(),
  action: z.enum(["ACCEPT", "START", "SUBMIT", "REJECT", "APPROVE", "COMPLETE"]),
  note: z.string().max(2000).optional(),
});

export async function createTaskAction(_state: TaskActionState, formData: FormData): Promise<TaskActionState> {
  const actor = await currentActor();
  const parsed = createSchema.safeParse({
    projectId: formData.get("projectId"), title: formData.get("title"), description: formData.get("description") ?? "",
    priority: formData.get("priority"), assigneeId: formData.get("assigneeId"), dueAt: formData.get("dueAt"),
  });
  if (!parsed.success) return { status: "error", message: "请完整填写任务标题、负责人、优先级和截止时间。" };
  try {
    const dueAt = new Date(`${parsed.data.dueAt}:00+08:00`);
    await createPrismaTaskStore(getDatabase()).createTask(actor, { ...parsed.data, dueAt });
    revalidatePath("/tasks");
    if (parsed.data.projectId) revalidatePath(`/projects/${parsed.data.projectId}`);
    return { status: "success", message: "任务已派发，员工可在任务待办中接收。" };
  } catch (error) {
    return taskErrorState(error);
  }
}

export async function transitionTaskAction(_state: TaskActionState, formData: FormData): Promise<TaskActionState> {
  const actor = await currentActor();
  const parsed = transitionSchema.safeParse({
    taskId: formData.get("taskId"), projectId: formData.get("projectId"), version: formData.get("version"),
    action: formData.get("action"), note: formData.get("note") || undefined,
  });
  if (!parsed.success) return { status: "error", message: "操作内容无效，请刷新后重试。" };
  try {
    await createPrismaTaskStore(getDatabase()).transition(
      actor, parsed.data.taskId, parsed.data.version, { type: parsed.data.action, note: parsed.data.note },
    );
    revalidatePath("/tasks");
    if (parsed.data.projectId) revalidatePath(`/projects/${parsed.data.projectId}`);
    return { status: "success", message: successMessage(parsed.data.action) };
  } catch (error) {
    return taskErrorState(error);
  }
}

async function currentActor(): Promise<Actor> {
  const user = await requireCurrentUser();
  return { id: user.id, role: user.role, departmentId: user.department?.id ?? null, operationsTeam: user.operationsTeam };
}

function successMessage(action: z.infer<typeof transitionSchema>["action"]) {
  return {
    ACCEPT: "任务已接收。", START: "任务已开始执行。", SUBMIT: "成果已提交，等待验收。",
    REJECT: "任务已退回修改，原因已记录。", APPROVE: "任务已验收完成。", COMPLETE: "任务已确认完成。",
  }[action];
}

function taskErrorState(error: unknown): TaskActionState {
  if (error instanceof TaskStoreError) {
    return { status: "error", message: {
      TASK_ASSIGN_FORBIDDEN: "你没有向该员工派发任务的权限。",
      TASK_PROJECT_FORBIDDEN: "你不在该项目中。",
      TASK_PROJECT_NOT_ACTIONABLE: "该项目不可继续创建任务。",
      TASK_ASSIGNEE_INVALID: "负责人账号无效、已停用或已退出项目。",
      TASK_INPUT_INVALID: "任务内容或截止时间无效，截止时间必须晚于现在。",
      TASK_NOT_FOUND: "任务不存在。",
      TASK_VIEW_FORBIDDEN: "你无权查看该任务。",
      TASK_CONFLICT: "任务刚刚被更新，请刷新后重试。",
    }[error.code] };
  }
  if (error instanceof TaskWorkflowError) {
    return { status: "error", message: {
      TASK_TRANSITION_INVALID: "当前状态不能执行这个操作。",
      TASK_EXECUTE_FORBIDDEN: "只有任务负责人可以执行此操作。",
      TASK_REVIEW_FORBIDDEN: "只有派发人或最高管理员可以验收。",
      TASK_NOTE_REQUIRED: "提交说明或退回原因必须填写 2 至 2000 字。",
    }[error.code] };
  }
  return { status: "error", message: "任务操作失败，数据没有保留半成品，请稍后重试。" };
}
